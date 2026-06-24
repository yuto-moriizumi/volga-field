import type { WebSocket } from "ws";
import type {
  ClientMessage,
  PlayerId,
  RoomId,
  ServerMessage,
} from "@volga/shared";
import {
  CLIENT_MESSAGE_TYPES,
  type GameState,
} from "@volga/shared";
import {
  createGame,
  endTurn,
  playCard,
} from "@volga/game-core";
import {
  createRoom,
  isRoomFull,
  roomSummary,
  type Room,
  type RoomPlayer,
} from "./room.js";

const PORT = Number(process.env.PORT ?? 4000);

interface Client {
  id: PlayerId;
  ws: WebSocket;
  roomId: RoomId | null;
  name: string;
}

const clients = new Map<PlayerId, Client>();
const rooms = new Map<RoomId, Room>();

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: Room, msg: ServerMessage, except?: PlayerId): void {
  for (const p of room.players) {
    if (except && p.id === except) continue;
    send(p.ws, msg);
  }
}

function sanitizeHandForViewer(
  state: GameState,
  viewerId: PlayerId,
): GameState {
  const players = state.players.map((p) => {
    if (p.id === viewerId) return p;
    return {
      ...p,
      hand: p.hand.map(() => ({ id: "hidden" })),
    };
  });
  return { ...state, players };
}

function broadcastStateToAll(room: Room): void {
  if (!room.gameState) return;
  for (const p of room.players) {
    send(p.ws, {
      type: "game_state",
      gameState: sanitizeHandForViewer(room.gameState, p.id),
    });
  }
}

function startGame(room: Room): void {
  if (room.players.length !== 2) return;
  if (room.started) return;
  const { state, deck } = createGame(
    room.id,
    room.players.map((p) => ({ id: p.id, name: p.name })),
  );
  room.gameState = state;
  room.deck = deck;
  room.started = true;
  broadcastRoom(room, { type: "game_started", gameState: state });
  broadcastStateToAll(room);
}

function tryAutoStart(room: Room): void {
  if (room.players.length === 2 && !room.started) {
    const allReady = room.players.every((p) => p.ready);
    if (allReady) startGame(room);
  }
}

function removePlayerFromRoom(client: Client): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) {
    log(`remove_player: ${client.id} no longer in room ${client.roomId}`);
    return;
  }
  room.players = room.players.filter((p) => p.id !== client.id);
  log(`remove_player: ${client.id} left room ${room.id} (${room.players.length} remaining)`);
  if (room.players.length === 0) {
    rooms.delete(room.id);
    log(`room_deleted: ${room.id} (empty)`);
    client.roomId = null;
    return;
  }
  broadcastRoom(room, { type: "player_left", playerId: client.id });
  client.roomId = null;
}

function log(msg: string): void {
  console.log(`[volga-field] ${msg}`);
}

function handleCreateRoom(client: Client, name: string): void {
  if (client.roomId) {
    log(`create_room rejected (already in room ${client.roomId}) from ${client.id}`);
    send(client.ws, { type: "error", message: "既にルームに参加しています" });
    return;
  }
  const id = genId("room");
  const roomPlayer: RoomPlayer = {
    id: client.id,
    ws: client.ws,
    name: name || "プレイヤー",
    ready: false,
  };
  const room = createRoom(id, roomPlayer);
  rooms.set(id, room);
  client.roomId = id;
  client.name = name || "プレイヤー";
  log(`create_room: ${id} by ${client.id} (${client.name})`);
  send(client.ws, {
    type: "room_created",
    roomId: id,
    gameState: room.gameState ?? placeholderState(id, [roomPlayer]),
  });
}

function placeholderState(roomId: RoomId, players: RoomPlayer[]): GameState {
  return {
    roomId,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      hp: 20,
      maxHp: 20,
      hand: [],
      equipped: { weapon: null, shield: null, barrier: false },
      ready: p.ready,
    })),
    deckSize: 0,
    turn: 0,
    activePlayerIndex: 0,
    phase: "draw",
    log: [
      {
        turn: 0,
        playerId: players[0]?.id ?? "system",
        message: "対戦相手を待っています...",
        kind: "system",
      },
    ],
    winner: null,
    startedAt: Date.now(),
  };
}

function handleJoinRoom(client: Client, roomId: RoomId, name: string): void {
  if (client.roomId && client.roomId !== roomId) {
    log(`join_room rejected (${client.id} already in ${client.roomId}, requested ${roomId})`);
    send(client.ws, { type: "error", message: "既にルームに参加しています" });
    return;
  }
  if (client.roomId === roomId) {
    const room = rooms.get(roomId);
    if (!room) {
      log(`join_room rejected (room ${roomId} not found) from ${client.id}`);
      send(client.ws, { type: "error", message: "ルームが存在しません" });
      return;
    }
    log(`join_room: rejoin ${client.id} (${client.name}) to ${roomId}`);
    send(client.ws, {
      type: "room_joined",
      gameState: room.gameState ?? placeholderState(roomId, room.players),
    });
    return;
  }
  const room = rooms.get(roomId);
  if (!room) {
    log(`join_room rejected (room ${roomId} not found) from ${client.id}`);
    send(client.ws, { type: "error", message: "ルームが存在しません" });
    return;
  }
  if (isRoomFull(room)) {
    log(`join_room rejected (room ${roomId} is full)`);
    send(client.ws, { type: "error", message: "ルームが満員です" });
    return;
  }
  if (room.started) {
    log(`join_room rejected (room ${roomId} already started)`);
    send(client.ws, { type: "error", message: "ゲームは既に開始しています" });
    return;
  }
  const newPlayer: RoomPlayer = {
    id: client.id,
    ws: client.ws,
    name: name || "プレイヤー",
    ready: false,
  };
  room.players.push(newPlayer);
  client.roomId = roomId;
  client.name = name || "プレイヤー";
  log(`join_room: ${client.id} (${client.name}) joined ${roomId}`);
  broadcastRoom(room, {
    type: "player_joined",
    player: {
      id: newPlayer.id,
      name: newPlayer.name,
      hp: 20,
      maxHp: 20,
      hand: [],
      equipped: { weapon: null, shield: null, barrier: false },
      ready: false,
    },
  });
  const updatedState = room.gameState ?? placeholderState(roomId, room.players);
  for (const p of room.players) {
    if (p.id === newPlayer.id) continue;
    send(p.ws, {
      type: "game_state",
      gameState: sanitizeHandForViewer(updatedState, p.id),
    });
  }
  send(client.ws, {
    type: "room_joined",
    gameState: updatedState,
  });
  tryAutoStart(room);
}

function handleReady(client: Client): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) return;
  const player = room.players.find((p) => p.id === client.id);
  if (!player) return;
  player.ready = !player.ready;
  log(`ready: ${client.id} in ${room.id} -> ${player.ready}`);
  const state = room.gameState ?? placeholderState(room.id, room.players);
  for (const p of room.players) {
    send(p.ws, {
      type: "game_state",
      gameState: sanitizeHandForViewer(state, p.id),
    });
  }
  tryAutoStart(room);
}

function handlePlayCard(
  client: Client,
  cardId: string,
): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = playCard(room.gameState, client.id, { id: cardId });
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
  broadcastRoom(room, {
    type: "card_played",
    playerId: client.id,
    cardRef: { id: cardId },
  });
}

function handleEndTurn(client: Client): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = endTurn(room.gameState, client.id, room.deck);
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  room.deck = result.deck;
  broadcastStateToAll(room);
}

function handleLeaveRoom(client: Client): void {
  removePlayerFromRoom(client);
}

function handleListRooms(client: Client): void {
  const list = Array.from(rooms.values())
    .filter((r) => !r.started)
    .map(roomSummary);
  send(client.ws, { type: "rooms_list", rooms: list });
}

function handlePing(client: Client): void {
  send(client.ws, { type: "pong" });
}

function dispatch(client: Client, msg: ClientMessage): void {
  switch (msg.type) {
    case "create_room":
      handleCreateRoom(client, msg.playerName);
      break;
    case "join_room":
      handleJoinRoom(client, msg.roomId, msg.playerName);
      break;
    case "leave_room":
      handleLeaveRoom(client);
      break;
    case "ready":
      handleReady(client);
      break;
    case "play_card":
      handlePlayCard(client, msg.cardRef.id);
      break;
    case "end_turn":
      handleEndTurn(client);
      break;
    case "list_rooms":
      handleListRooms(client);
      break;
    case "ping":
      handlePing(client);
      break;
  }
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown };
  return (
    typeof v.type === "string" &&
    CLIENT_MESSAGE_TYPES.includes(v.type as ClientMessage["type"])
  );
}

export async function startServer(): Promise<void> {
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ port: PORT });

  log(`startup: listening on ws://localhost:${PORT}`);

  wss.on("connection", (ws, req) => {
    const id = genId("p");
    const client: Client = { id, ws, roomId: null, name: "プレイヤー" };
    clients.set(id, client);
    const ip = req.socket.remoteAddress ?? "unknown";
    log(`connection: ${id} from ${ip}`);
    send(ws, { type: "connected", playerId: id });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (isClientMessage(parsed)) {
          log(`message: ${id} -> ${parsed.type}`);
          dispatch(client, parsed);
        } else {
          log(`message_invalid: ${id} sent non-client message`);
          send(ws, { type: "error", message: "不正なメッセージ" });
        }
      } catch (err) {
        log(`message_parse_error: ${id} ${(err as Error).message}`);
        send(ws, { type: "error", message: "JSONパースエラー" });
      }
    });

    ws.on("close", () => {
      log(`disconnect: ${id} (room=${client.roomId ?? "none"})`);
      removePlayerFromRoom(client);
      clients.delete(id);
    });

    ws.on("error", (err) => {
      log(`socket_error: ${id} ${err.message}`);
      removePlayerFromRoom(client);
      clients.delete(id);
    });
  });

  setInterval(() => {
    if (clients.size > 0 || rooms.size > 0) {
      log(`status: clients=${clients.size} rooms=${rooms.size}`);
    }
  }, 30000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
}