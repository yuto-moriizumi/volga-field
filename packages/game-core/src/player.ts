import type { PlayerId, PlayerState } from "@volga/shared";
import { HAND_SIZE, INITIAL_HP } from "./cards.js";

export function createPlayer(
  id: PlayerId,
  name: string,
  startingHand: { id: string }[] = [],
): PlayerState {
  return {
    id,
    name,
    hp: INITIAL_HP,
    maxHp: INITIAL_HP,
    hand: startingHand,
    equipped: { weapon: null, shield: null, barrier: false },
    ready: false,
  };
}

export function isAlive(p: PlayerState): boolean {
  return p.hp > 0;
}

export function handSize(p: PlayerState): number {
  return p.hand.length;
}

export function needsDraw(p: PlayerState): boolean {
  return p.hand.length < HAND_SIZE;
}

export function damagePlayer(p: PlayerState, amount: number): PlayerState {
  const newHp = Math.max(0, p.hp - amount);
  return { ...p, hp: newHp };
}

export function healPlayer(p: PlayerState, amount: number): PlayerState {
  const newHp = Math.min(p.maxHp, p.hp + amount);
  return { ...p, hp: newHp };
}