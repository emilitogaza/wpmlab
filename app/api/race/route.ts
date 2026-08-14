import { createRoom } from "@/lib/race/store";

/** Rooms live in this process's memory, so nothing here can be prerendered. */
export const dynamic = "force-dynamic";

export async function POST() {
  const roomId = createRoom();
  if (!roomId) return Response.json({ error: "too many races right now — try again in a bit" }, { status: 503 });
  return Response.json({ roomId });
}
