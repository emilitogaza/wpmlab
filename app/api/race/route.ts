import { createRoom } from "@/lib/race/store";

// rooms live in memory — never prerender
export const dynamic = "force-dynamic";

export async function POST() {
  const roomId = createRoom();
  if (!roomId) return Response.json({ error: "too many races right now — try again in a bit" }, { status: 503 });
  return Response.json({ roomId });
}
