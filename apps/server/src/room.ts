import type { CardRef, DoomsdayTurn, GameState, PlayerId, RoomId } from "@volga/shared";

export interface RoomPlayer {
  id: PlayerId;
  ws: import("ws").WebSocket | null;
  name: string;
  ready: boolean;
  ai?: boolean;
}

export type RoomMode = "training" | "versus";

export interface Room {
  id: RoomId;
  hostId: PlayerId;
  players: RoomPlayer[];
  gameState: GameState | null;
  deck: CardRef[];
  started: boolean;
  mode: RoomMode;
  doomsdayTurn: DoomsdayTurn | null;
}

export const MAX_PLAYERS = 9;
export const VERSUS_MAX_PLAYERS = 2;

export function createRoom(
  id: RoomId,
  host: RoomPlayer,
  mode: RoomMode = "versus",
  doomsdayTurn: DoomsdayTurn | null = null,
): Room {
  return {
    id,
    hostId: host.id,
    players: [host],
    gameState: null,
    deck: [],
    started: false,
    mode,
    doomsdayTurn,
  };
}

export function findOpponent(room: Room, selfId: PlayerId): RoomPlayer | null {
  return room.players.find((p) => p.id !== selfId) ?? null;
}

export function isRoomFull(room: Room): boolean {
  const maxPlayers = room.mode === "training" ? MAX_PLAYERS : VERSUS_MAX_PLAYERS;
  return room.players.length >= maxPlayers;
}

export function playerIds(room: Room): PlayerId[] {
  return room.players.map((p) => p.id);
}

export function snapshotPlayerIds(room: Room): PlayerId[] {
  return room.players.map((p) => p.id);
}

export function listRoomIds(rooms: Map<RoomId, Room>): RoomId[] {
  return Array.from(rooms.keys());
}

export function roomSummary(room: Room) {
  return {
    id: room.id,
    hostName: room.players[0]?.name ?? "?",
    playerCount: room.players.length,
    maxPlayers: room.mode === "training" ? MAX_PLAYERS : VERSUS_MAX_PLAYERS,
    status: room.started
      ? ("playing" as const)
      : room.gameState?.winner
        ? ("finished" as const)
        : ("waiting" as const),
  };
}
