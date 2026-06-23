export type PlayerId = string;
export type RoomId = string;
export type CardId = string;

export type CardCategory = "weapon" | "shield" | "potion" | "magic" | "special";

export interface CardRef {
  id: CardId;
  power?: number;
}

export interface EquippedWeapon extends CardRef {
  power: number;
}

export interface EquippedShield extends CardRef {
  power: number;
}

export interface EquippedItems {
  weapon: EquippedWeapon | null;
  shield: EquippedShield | null;
  barrier: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  hp: number;
  maxHp: number;
  hand: CardRef[];
  equipped: EquippedItems;
  ready: boolean;
}

export type TurnPhase = "draw" | "play" | "resolved";

export interface BattleLogEntry {
  turn: number;
  playerId: PlayerId;
  message: string;
  kind: "attack" | "heal" | "equip" | "magic" | "system" | "special";
  damage?: number;
}

export interface GameState {
  roomId: RoomId;
  players: PlayerState[];
  deckSize: number;
  turn: number;
  activePlayerIndex: number;
  phase: TurnPhase;
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