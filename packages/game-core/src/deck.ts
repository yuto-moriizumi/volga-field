import { BASE_CARDS, DECK_SIZE } from "./cards.js";
import type { CardRef } from "@volga/shared";

export function buildDeck(seed: number): CardRef[] {
  const cards: CardRef[] = BASE_CARDS.map((card) => ({ id: card.id }));
  return shuffle(cards, seed).slice(0, DECK_SIZE);
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function drawCards(deck: CardRef[], n: number): {
  drawn: CardRef[];
  deck: CardRef[];
} {
  const drawn = deck.slice(0, n);
  const rest = deck.slice(n);
  return { drawn, deck: rest };
}