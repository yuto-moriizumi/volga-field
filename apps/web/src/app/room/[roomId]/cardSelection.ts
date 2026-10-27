import { findCard } from "@volga/game-core";

/**
 * Attack cards are not only direct-damage weapons: an `attack_power` card
 * (`攻+N`) is added to the same attack and must be aimed at the opponent too.
 */
export function isAttackCard(cardId: string): boolean {
  const card = findCard(cardId);
  if (!card) return false;
  return card.effects.some(
    (effect) =>
      (effect.kind === "damage" && effect.target === "opponent") ||
      effect.kind === "attack_power",
  );
}

/**
 * Default target for a card: trades and attacks point at another player,
 * everything else at the user.
 */
export function defaultTargetId(
  cardId: string,
  selfId: string,
  opponentId: string | null,
): string | undefined {
  const card = findCard(cardId);
  if (card?.category === "trade") return opponentId ?? undefined;
  return isAttackCard(cardId) ? (opponentId ?? undefined) : selfId;
}
