"use client";

import { findCard } from "@volga/game-core";
import type { CardRef } from "@volga/shared";

export function LargeCard({ cardRef }: { cardRef: CardRef }) {
  const card = findCard(cardRef.id);
  if (!card) return null;
  const power =
    card.category === "miracle"
      ? card.mpCost
      : card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  return (
    <div className="gf-large-card">
      <div className="gf-large-card-art">
        {card.emoji}
      </div>
      <div className="gf-large-card-body">
        <div className="gf-large-card-name">{card.name}</div>
        <div className="gf-large-card-power">
          {card.category === "miracle" ? "MP" : card.category === "shield" ? "守" : "攻"}
          {power ?? ""}
        </div>
        <div className="gf-large-card-desc">{card.description}</div>
      </div>
    </div>
  );
}
