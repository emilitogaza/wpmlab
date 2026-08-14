import type { NextRequest } from "next/server";
import { roomExists, subscribe } from "@/lib/race/store";
import type { RaceSnapshot } from "@/lib/race/types";

export const dynamic = "force-dynamic";

/**
 * Server-sent events: one long-lived response per player, carrying a room
 * snapshot whenever anything changes and at 10Hz while a race is running.
 *
 * SSE rather than WebSockets because Next route handlers speak it natively —
 * no custom server, no upgrade handling. The cost is that the client→server
 * direction is ordinary POSTs, which for five players at 10Hz is fine.
 */
export async function GET(request: NextRequest, context: RouteContext<"/api/race/[roomId]/stream">) {
  const { roomId } = await context.params;
  const playerId = request.nextUrl.searchParams.get("playerId");

  if (!playerId) return Response.json({ error: "playerId required" }, { status: 400 });
  if (!roomExists(roomId)) return Response.json({ error: "room not found" }, { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (snapshot: RaceSnapshot) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          // The client vanished between the room's broadcast and this write;
          // the abort handler below does the actual cleanup.
          closed = true;
        }
      };

      unsubscribe = subscribe(roomId, { playerId, send });

      if (!unsubscribe) {
        controller.close();
        return;
      }

      // Comment frames keep proxies from closing an idle lobby connection.
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15_000);

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      request.signal.addEventListener("abort", close);
    },

    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx and friends buffer streamed responses by default, which would
      // hold every countdown frame until the race was over.
      "X-Accel-Buffering": "no",
    },
  });
}
