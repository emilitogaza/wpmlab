import type { NextRequest } from "next/server";
import { applyAction, getSnapshot } from "@/lib/race/store";
import type { RaceAction } from "@/lib/race/types";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/race/[roomId]">) {
  const { roomId } = await context.params;
  const snapshot = getSnapshot(roomId);
  if (!snapshot) return Response.json({ error: "room not found" }, { status: 404 });
  return Response.json(snapshot);
}

// an honest finish is a few KB; anything near this limit is someone probing
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: NextRequest, context: RouteContext<"/api/race/[roomId]">) {
  const { roomId } = await context.params;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "body too large" }, { status: 413 });
  }

  let action: RaceAction;
  try {
    action = (await request.json()) as RaceAction;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  if (typeof action?.type !== "string" || typeof action?.playerId !== "string") {
    return Response.json({ error: "invalid action" }, { status: 400 });
  }

  const result = applyAction(roomId, action);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });

  return Response.json({ ok: true });
}
