import { RaceRoom } from "@/components/race/race-room";

export default async function RacePage({ params }: PageProps<"/race/[roomId]">) {
  const { roomId } = await params;
  return <RaceRoom roomId={roomId} />;
}
