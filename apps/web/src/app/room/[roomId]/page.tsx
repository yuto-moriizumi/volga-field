import { GameRoom } from "./GameRoom";

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  return <GameRoom params={params} />;
}