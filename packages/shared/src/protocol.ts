import type {
  CardRef,
  DoomsdayTurn,
  GameState,
  PlayerId,
  PlayerState,
  RoomId,
  RoomSummary,
  TrainingPlayerCount,
} from "./types.js";

export type ClientMessage =
  | {
      type: "create_room";
      playerName: string;
      roomId?: RoomId;
      mode?: "training" | "versus";
      doomsdayTurn?: DoomsdayTurn | null;
      trainingPlayerCount?: TrainingPlayerCount;
    }
  | { type: "join_room"; roomId: RoomId; playerName: string }
  | { type: "leave_room" }
  | { type: "ready" }
  | { type: "play_card"; cardRef?: CardRef; cardRefs?: CardRef[]; targetPlayerId?: PlayerId }
  | { type: "defend"; cardRef?: CardRef; cardRefs?: CardRef[] }
  | { type: "discard_cards"; cardRefs: CardRef[] }
  | { type: "buy_card"; cardRef: CardRef; targetPlayerId: PlayerId }
  | { type: "confirm_buy"; accept: boolean }
  | { type: "sell_cards"; cardRefs: CardRef[]; targetPlayerId: PlayerId }
  | { type: "exchange_stats"; mpDelta: number; moneyDelta: number }
  | { type: "end_turn" }
  | { type: "list_rooms" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "connected"; playerId: PlayerId }
  | { type: "room_created"; roomId: RoomId; gameState: GameState }
  | { type: "room_joined"; gameState: GameState }
  | { type: "rooms_list"; rooms: RoomSummary[]; playerCount: number }
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; playerId: PlayerId }
  | { type: "game_started"; gameState: GameState }
  | { type: "game_state"; gameState: GameState }
  | { type: "card_played"; playerId: PlayerId; cardRef: CardRef }
  | { type: "error"; message: string }
  | { type: "pong" };

export type AnyMessage = ClientMessage | ServerMessage;

export const CLIENT_MESSAGE_TYPES: ClientMessage["type"][] = [
  "create_room",
  "join_room",
  "leave_room",
  "ready",
  "play_card",
  "defend",
  "discard_cards",
  "buy_card",
  "confirm_buy",
  "sell_cards",
  "exchange_stats",
  "end_turn",
  "list_rooms",
  "ping",
];

export const SERVER_MESSAGE_TYPES: ServerMessage["type"][] = [
  "connected",
  "room_created",
  "room_joined",
  "rooms_list",
  "player_joined",
  "player_left",
  "game_started",
  "game_state",
  "card_played",
  "error",
  "pong",
];
