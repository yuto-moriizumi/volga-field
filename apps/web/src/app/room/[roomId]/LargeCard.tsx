"use client";

import { findCard } from "@volga/game-core";
import type { CardRef } from "@volga/shared";

export function LargeCard({ cardRef }: { cardRef: CardRef }) {
  const card = findCard(cardRef.id);
  if (!card) return null;
  if (card.category === "trade") {
    return (
      <div className="gf-large-card">
        <div className="gf-large-card-art">
          {card.emoji}
        </div>
        <div className="gf-large-card-body">
          <div className="gf-large-card-name">{card.name}</div>
          <div className="gf-large-card-desc">{card.description}</div>
        </div>
      </div>
    );
  }
  const power =
    card.category === "miracle"
      ? card.mpCost
      : card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  const isMpRecover = card.effects.some((effect) => effect.kind === "mpRecover");
  const isHeal = card.effects.some((effect) => effect.kind === "heal");
  const isAttackPower = card.effects.every(
    (effect) => effect.kind === "attack_power",
  );
  return (
    <div className="gf-large-card">
      <div className="gf-large-card-art">
        {card.emoji}
      </div>
      <div className="gf-large-card-body">
        <div className="gf-large-card-name">{card.name}</div>
        <div className="gf-large-card-power">
          {card.category === "miracle"
            ? "MP"
            : card.category === "shield"
              ? "守"
              : isMpRecover
                ? "MP+"
                : isHeal
                  ? "HP+"
                  : isAttackPower
                    ? "+"
                    : "攻"}
          {power ?? ""}
          {typeof card.price === "number" && card.price > 0 && (
            <span className="gf-large-card-price"> ￥{card.price}</span>
          )}
        </div>
        <div className="gf-large-card-desc">{card.description}</div>
      </div>
    </div>
  );
}
