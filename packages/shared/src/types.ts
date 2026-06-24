export type PlayerId = string;
export type RoomId = string;
export type CardId = string;

export type CardCategory = "weapon" | "shield" | "potion" | "miracle" | "special";

export interface CardRef {
  id: CardId;
  power?: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  hand: CardRef[];
  learnedMiracles: CardRef[];
  ready: boolean;
}

export type TurnPhase = "draw" | "play" | "defense" | "resolved";
export type DoomsdayTurn = 50 | 75 | 100;
export type TrainingPlayerCount = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface PendingAttack {
  attackerId: PlayerId;
  defenderId: PlayerId;
  card: CardRef;
  cardName: string;
  amount: number;
}

export interface BattleLogEntry {
  turn: number;
  playerId: PlayerId;
  message: string;
  kind: "attack" | "heal" | "defense" | "miracle" | "system" | "special";
  damage?: number;
}

export interface GameState {
  roomId: RoomId;
  players: PlayerState[];
  deckSize: number;
  turn: number;
  actionTurn: number;
  doomsdayTurn: DoomsdayTurn | null;
  doomsdayActive: boolean;
  activePlayerIndex: number;
  phase: TurnPhase;
  pendingAttack: PendingAttack | null;
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
