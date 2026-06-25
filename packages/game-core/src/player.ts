import type { PlayerId, PlayerState } from "@volga/shared";
import { HAND_SIZE, INITIAL_HP, INITIAL_MONEY, INITIAL_MP } from "./cards.js";

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
    mp: INITIAL_MP,
    maxMp: INITIAL_MP,
    money: INITIAL_MONEY,
    hand: startingHand,
    learnedMiracles: [],
    party: null,
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
  const newHp = p.hp + amount;
  return { ...p, hp: newHp };
}

export function spendMp(p: PlayerState, amount: number): PlayerState {
  return { ...p, mp: Math.max(0, p.mp - amount) };
}

export function recoverMp(p: PlayerState, amount: number): PlayerState {
  return { ...p, mp: Math.min(p.maxMp, p.mp + amount) };
}

export function transferMoney(
  source: PlayerState,
  target: PlayerState,
  amount: number,
): { source: PlayerState; target: PlayerState; actualAmount: number } {
  const actualAmount = Math.max(0, Math.min(amount, source.money));
  return {
    source: { ...source, money: source.money - actualAmount },
    target: { ...target, money: target.money + actualAmount },
    actualAmount,
  };
}

export interface ChargeResult {
  player: PlayerState;
  moneyPaid: number;
  mpPaid: number;
  hpPaid: number;
}

export function chargePlayer(
  player: PlayerState,
  amount: number,
): ChargeResult {
  const moneyPaid = Math.min(player.money, amount);
  let remaining = amount - moneyPaid;
  const mpPaid = Math.min(player.mp, remaining);
  remaining -= mpPaid;
  const hpPaid = Math.min(player.hp, remaining);
  return {
    player: {
      ...player,
      money: player.money - moneyPaid,
      mp: player.mp - mpPaid,
      hp: player.hp - hpPaid,
    },
    moneyPaid,
    mpPaid,
    hpPaid,
  };
}
