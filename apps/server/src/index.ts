import type { WebSocket } from "ws";
import type {
  CardRef,
  ClientMessage,
  DoomsdayTurn,
  PlayerId,
  RoomId,
  ServerMessage,
  TrainingPlayerCount,
} from "@volga/shared";
import {
  CLIENT_MESSAGE_TYPES,
  type GameState,
} from "@volga/shared";
import {
  confirmBuy,
  createGame,
  defendAttack,
  discardCards,
  endTurn,
  exchangeStats,
  findCard,
  playCard,
  sellCards,
  startBuy,
} from "@volga/game-core";
import {
  createRoom,
  isRoomFull,
  roomSummary,
  type Room,
  type RoomMode,
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
    if (!p.ws) continue;
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
    if (!p.ws) continue;
    send(p.ws, {
      type: "game_state",
      gameState: sanitizeHandForViewer(room.gameState, p.id),
    });
  }
}

function startGame(room: Room): void {
  if (room.players.length < 2) return;
  if (room.started) return;
  const { state, deck } = createGame(
    room.id,
    room.players.map((p) => ({ id: p.id, name: p.name })),
    { doomsdayTurn: room.doomsdayTurn },
  );
  room.gameState = state;
  room.deck = deck;
  room.started = true;
  for (const p of room.players) {
    if (!p.ws) continue;
    send(p.ws, {
      type: "game_started",
      gameState: sanitizeHandForViewer(state, p.id),
    });
  }
  broadcastStateToAll(room);
}

function activePlayer(room: Room): RoomPlayer | null {
  if (!room.gameState) return null;
  const activeState = room.gameState.players[room.gameState.activePlayerIndex];
  if (!activeState) return null;
  return room.players.find((p) => p.id === activeState.id) ?? null;
}

function defensePower(cardRef: CardRef): number {
  return (
    findCard(cardRef.id)?.effects.find((effect) => effect.kind === "defense")?.amount ?? 0
  );
}

function pickAiDefenseCards(room: Room, aiId: PlayerId): CardRef[] {
  const aiState = room.gameState?.players.find((p) => p.id === aiId);
  const pendingAmount = room.gameState?.pendingAttack?.amount ?? 0;
  const cards =
    aiState?.hand
      .filter((cardRef) => defensePower(cardRef) > 0)
      .sort((a, b) => defensePower(b) - defensePower(a)) ?? [];
  const selected: CardRef[] = [];
  let total = 0;
  for (const card of cards) {
    selected.push({ id: card.id });
    total += defensePower(card);
    if (total >= pendingAmount) break;
  }
  return selected;
}

function finishActiveAiTurn(room: Room): boolean {
  const ai = activePlayer(room);
  if (!ai?.ai || !room.gameState || room.gameState.winner || room.gameState.phase === "defense") {
    return false;
  }

  const ended = endTurn(room.gameState, ai.id, room.deck);
  if (!ended.ok) return false;
  room.gameState = ended.state;
  room.deck = ended.deck;
  broadcastStateToAll(room);
  return true;
}

function resolveAiDefense(room: Room): boolean {
  const pending = room.gameState?.pendingAttack;
  if (!pending || room.gameState?.phase !== "defense") return false;
  const defender = room.players.find((p) => p.id === pending.defenderId);
  if (!defender?.ai) return false;

  const defended = defendAttack(room.gameState, defender.id, pickAiDefenseCards(room, defender.id));
  if (!defended.ok) return false;
  room.gameState = defended.state;
  broadcastStateToAll(room);
  return true;
}

function runAiTurn(room: Room): void {
  for (let guard = 0; guard < room.players.length * 2; guard += 1) {
    const ai = activePlayer(room);
    if (!ai?.ai || !room.gameState || room.gameState.winner) return;

    const aiState = room.gameState.players.find((p) => p.id === ai.id);
    const target = room.gameState.players.find((p) => p.id !== ai.id && p.hp > 0);
    const card = aiState?.hand.find((c) => findCard(c.id)?.category !== "trade");
    if (card) {
      const played = playCard(room.gameState, ai.id, { id: card.id }, target?.id, room.deck);
      if (played.ok) {
        room.gameState = played.state;
        room.deck = played.deck;
        broadcastStateToAll(room);
      }
    }

    resolveAiDefense(room);
    if (!room.gameState || room.gameState.winner) return;
    if (!finishActiveAiTurn(room)) return;
  }
}

function tryAutoStart(room: Room): void {
  if (room.players.length >= 2 && !room.started) {
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
  if (!room.players.some((p) => !p.ai)) {
    rooms.delete(room.id);
    log(`room_deleted: ${room.id} (no human players)`);
    client.roomId = null;
    return;
  }
  broadcastRoom(room, { type: "player_left", playerId: client.id });
  client.roomId = null;
}

function log(msg: string): void {
  console.log(`[volga-field] ${msg}`);
}

function normalizeRoomId(roomId?: RoomId): RoomId | null {
  const trimmed = roomId?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDoomsdayTurn(value: DoomsdayTurn | undefined | null): DoomsdayTurn | null {
  return value === 50 || value === 75 || value === 100 ? value : null;
}

function normalizeTrainingPlayerCount(value: TrainingPlayerCount | undefined): TrainingPlayerCount {
  return typeof value === "number" && value >= 2 && value <= 9
    ? (Math.floor(value) as TrainingPlayerCount)
    : 2;
}

function handleCreateRoom(
  client: Client,
  name: string,
  requestedRoomId?: RoomId,
  mode: RoomMode = "versus",
  doomsdayTurn: DoomsdayTurn | null = null,
  trainingPlayerCount: TrainingPlayerCount = 2,
): void {
  if (client.roomId) {
    log(`create_room rejected (already in room ${client.roomId}) from ${client.id}`);
    send(client.ws, { type: "error", message: "既にルームに参加しています" });
    return;
  }
  const id = normalizeRoomId(requestedRoomId) ?? genId("room");
  const existingRoom = rooms.get(id);
  if (existingRoom) {
    handleJoinRoom(client, id, name);
    return;
  }
  const roomPlayer: RoomPlayer = {
    id: client.id,
    ws: client.ws,
    name: name || "プレイヤー",
    ready: false,
  };
  const room = createRoom(id, roomPlayer, mode, normalizeDoomsdayTurn(doomsdayTurn));
  if (mode === "training") {
    const totalPlayers = normalizeTrainingPlayerCount(trainingPlayerCount);
    for (let i = 2; i <= totalPlayers; i += 1) {
      room.players.push({
        id: genId("ai"),
        ws: null,
        name: totalPlayers === 2 ? "修行相手" : `修行相手${i - 1}`,
        ready: true,
        ai: true,
      });
    }
    roomPlayer.ready = true;
  }
  rooms.set(id, room);
  client.roomId = id;
  client.name = name || "プレイヤー";
  log(`create_room: ${id} by ${client.id} (${client.name})`);
  if (mode === "training") {
    startGame(room);
  }
  send(client.ws, {
    type: "room_created",
    roomId: id,
    gameState: room.gameState ?? placeholderState(id, room.players, room.doomsdayTurn),
  });
}

function placeholderState(
  roomId: RoomId,
  players: RoomPlayer[],
  doomsdayTurn: DoomsdayTurn | null = null,
): GameState {
  return {
    roomId,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      hp: 20,
      maxHp: 20,
      mp: 10,
      maxMp: 10,
      money: 20,
      hand: [],
      learnedMiracles: [],
      party: null,
      ready: p.ready,
    })),
    deckSize: 0,
    turn: 0,
    actionTurn: 0,
    doomsdayTurn,
    doomsdayActive: false,
    activePlayerIndex: 0,
    phase: "draw",
    pendingAttack: null,
    pendingBuy: null,
    pendingSell: null,
    pendingExchange: null,
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
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    send(client.ws, { type: "error", message: "部屋の合言葉を入力してください" });
    return;
  }
  roomId = normalizedRoomId;
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
      gameState: room.gameState ?? placeholderState(roomId, room.players, room.doomsdayTurn),
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
      mp: 10,
      maxMp: 10,
      money: 20,
      hand: [],
      learnedMiracles: [],
      party: null,
      ready: false,
    },
  });
  const updatedState = room.gameState ?? placeholderState(roomId, room.players, room.doomsdayTurn);
  for (const p of room.players) {
    if (p.id === newPlayer.id || !p.ws) continue;
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
  const state = room.gameState ?? placeholderState(room.id, room.players, room.doomsdayTurn);
  for (const p of room.players) {
    if (!p.ws) continue;
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
  targetPlayerId?: PlayerId,
): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = playCard(room.gameState, client.id, { id: cardId }, targetPlayerId, room.deck);
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  room.deck = result.deck;
  broadcastStateToAll(room);
  broadcastRoom(room, {
    type: "card_played",
    playerId: client.id,
    cardRef: { id: cardId },
  });
  if (resolveAiDefense(room) && room.gameState && !room.gameState.winner) {
    const ended = endTurn(room.gameState, client.id, room.deck);
    if (ended.ok) {
      room.gameState = ended.state;
      room.deck = ended.deck;
      broadcastStateToAll(room);
      runAiTurn(room);
    }
  }
}

function handleDefend(client: Client, cardIds: string[] = []): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = defendAttack(
    room.gameState,
    client.id,
    cardIds.map((id) => ({ id })),
  );
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
  if (finishActiveAiTurn(room)) {
    runAiTurn(room);
  }
}

function handleDiscardCards(client: Client, cardIds: string[] = []): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = discardCards(
    room.gameState,
    client.id,
    cardIds.map((id) => ({ id })),
  );
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
}

function handleBuyCard(
  client: Client,
  cardId: string,
  targetPlayerId: PlayerId,
): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  if (cardId !== "buy") {
    send(client.ws, { type: "error", message: "buy card expected" });
    return;
  }
  const result = startBuy(room.gameState, client.id, targetPlayerId);
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
}

function handleConfirmBuy(client: Client, accept: boolean): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = confirmBuy(room.gameState, client.id, accept);
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
}

function handleSellCards(
  client: Client,
  cardIds: string[],
  targetPlayerId: PlayerId,
): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = sellCards(
    room.gameState,
    client.id,
    cardIds.map((id) => ({ id })),
    targetPlayerId,
  );
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
}

function handleExchangeStats(
  client: Client,
  mpDelta: number,
  moneyDelta: number,
): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) return;
  const result = exchangeStats(room.gameState, client.id, mpDelta, moneyDelta);
  if (!result.ok) {
    send(client.ws, { type: "error", message: result.reason });
    return;
  }
  room.gameState = result.state;
  broadcastStateToAll(room);
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
  runAiTurn(room);
}

function handleLeaveRoom(client: Client): void {
  removePlayerFromRoom(client);
}

function handleListRooms(client: Client): void {
  const waitingRooms = Array.from(rooms.values()).filter((r) => !r.started);
  const playerCount = waitingRooms.reduce(
    (total, room) => total + room.players.length,
    0,
  );
  send(client.ws, {
    type: "rooms_list",
    rooms: waitingRooms.map(roomSummary),
    playerCount,
  });
}

function handlePing(client: Client): void {
  send(client.ws, { type: "pong" });
}

function dispatch(client: Client, msg: ClientMessage): void {
  switch (msg.type) {
    case "create_room":
      handleCreateRoom(
        client,
        msg.playerName,
        msg.roomId,
        msg.mode,
        normalizeDoomsdayTurn(msg.doomsdayTurn),
        normalizeTrainingPlayerCount(msg.trainingPlayerCount),
      );
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
      handlePlayCard(client, msg.cardRef.id, msg.targetPlayerId);
      break;
    case "defend":
      handleDefend(
        client,
        msg.cardRefs?.map((cardRef) => cardRef.id) ?? (msg.cardRef ? [msg.cardRef.id] : []),
      );
      break;
    case "discard_cards":
      handleDiscardCards(client, msg.cardRefs.map((cardRef) => cardRef.id));
      break;
    case "buy_card":
      handleBuyCard(client, msg.cardRef.id, msg.targetPlayerId);
      break;
    case "confirm_buy":
      handleConfirmBuy(client, msg.accept);
      break;
    case "sell_cards":
      handleSellCards(
        client,
        msg.cardRefs.map((cardRef) => cardRef.id),
        msg.targetPlayerId,
      );
      break;
    case "exchange_stats":
      handleExchangeStats(client, msg.mpDelta, msg.moneyDelta);
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
