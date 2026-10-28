export type PlayerId = string;
export type RoomId = string;
export type CardId = string;

export type CardCategory =
  | "weapon"
  | "shield"
  | "miracle"
  | "trade"
  | "misc"
  | "party";

export type CardAttribute =
  | "none"
  | "socialism"
  | "capitalism"
  | "republicanism"
  | "feudalism"
  | "environmentalism"
  | "anarchism";

export type PartyId =
  | "communist_party"
  | "ldp"
  | "democratic_party"
  | "constitutional_imperial_party"
  | "green_party"
  | "anarchist_party";

export interface CardRef {
  id: CardId;
  power?: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  hp: number;
  /** Initial/base HP. This is not an upper limit for healing. */
  maxHp: number;
  mp: number;
  maxMp: number;
  money: number;
  hand: CardRef[];
  learnedMiracles: CardRef[];
  party: PartyId | null;
  ready: boolean;
}

export type TurnPhase = "draw" | "play" | "defense" | "resolved";
export type DoomsdayTurn = 50 | 75 | 100;
export type TrainingPlayerCount = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface PendingAttack {
  attackerId: PlayerId;
  defenderId: PlayerId;
  card: CardRef;
  /** Every card played in the action, in play order (support cards included). */
  cards?: CardRef[];
  cardName: string;
  amount: number;
  /** Aggregated attribute of every card in the action. Undefined means "none". */
  attribute?: CardAttribute;
}

export interface PendingBuy {
  sourceId: PlayerId;
  targetId: PlayerId;
  card: CardRef;
  cardName: string;
  price: number;
}

export interface PendingSell {
  sourceId: PlayerId;
  targetId: PlayerId;
  cards: CardRef[];
  cardNames: string[];
  price: number;
}

export interface PendingExchange {
  sourceId: PlayerId;
  mpDelta: number;
  moneyDelta: number;
}

export interface BattleLogEntry {
  turn: number;
  playerId: PlayerId;
  message: string;
  kind: "attack" | "heal" | "defense" | "miracle" | "system" | "special" | "trade" | "mpRecover";
  damage?: number;
}

export interface GameState {
  roomId: RoomId;
  players: PlayerState[];
  turn: number;
  actionTurn: number;
  doomsdayTurn: DoomsdayTurn | null;
  doomsdayActive: boolean;
  activePlayerIndex: number;
  phase: TurnPhase;
  pendingAttack: PendingAttack | null;
  pendingBuy: PendingBuy | null;
  pendingSell: PendingSell | null;
  pendingExchange: PendingExchange | null;
  log: BattleLogEntry[];
  winner: PlayerId | null;
  startedAt: number;
}

export interface RoomSummary {
  id: RoomId;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: "waiting" | "playing" | "finished";
}
