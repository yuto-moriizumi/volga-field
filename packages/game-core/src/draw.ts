import { BASE_CARDS } from "./cards.js";
import type { Rng } from "./parties.js";
import type { CardRef } from "@volga/shared";

/**
 * 実装済みの全カード (BASE_CARDS) から復元抽出で n 枚引く。
 *
 * 山札という概念は無く、引いても候補は減らない。
 * そのため同じカードが複数枚引かれることもある。
 */
export function drawRandomCards(n: number, rng: Rng = Math.random): CardRef[] {
  if (!Number.isFinite(n) || n <= 0) return [];
  const drawn: CardRef[] = [];
  for (let i = 0; i < Math.floor(n); i++) {
    const index = Math.min(
      BASE_CARDS.length - 1,
      Math.floor(rng() * BASE_CARDS.length),
    );
    drawn.push({ id: BASE_CARDS[index]!.id });
  }
  return drawn;
}
