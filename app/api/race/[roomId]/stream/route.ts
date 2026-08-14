import type { NextRequest } from "next/server";
import { roomExists, subscribe } from "@/lib/race/store";
import type { RaceSnapshot } from "@/lib/race/types";

export const dynamic = "force-dynamic";

// SSE, not WebSockets — Next route handlers speak it natively, no custom
// server. The upstream direction is plain POSTs, which is fine at this scale.
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
          // client vanished mid-write; the abort handler does the real cleanup
          closed = true;
        }
      };

      unsubscribe = subscribe(roomId, { playerId, send });

      if (!unsubscribe) {
        controller.close();
        return;
      }

      // comment frames keep proxies from closing an idle lobby connection
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
          // already closed by the runtime
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
      // nginx buffers streamed responses by default
      "X-Accel-Buffering": "no",
    },
  });
}
