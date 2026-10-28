"use client";

import { findCard } from "@volga/game-core";
import type { CardDefinition } from "@volga/game-core";
import type { CardRef } from "@volga/shared";
import { AttributeBadge } from "../../attributes";

export function LargeCard({ cardRef }: { cardRef: CardRef }) {
  const card = findCard(cardRef.id);
  if (!card) return null;
  // 武器と盾は無属性でもバッジを出す（防御の判断に属性が要るため）。
  // それ以外のカードは属性を持つときだけ出す。
  const showAttribute =
    card.category === "weapon" ||
    card.category === "shield" ||
    card.attribute !== "none";
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
  return (
    <div className="gf-large-card">
      <div className="gf-large-card-art">
        {card.emoji}
      </div>
      <div className="gf-large-card-body">
        <div className="gf-large-card-name">
          <span className="gf-large-card-name-text">{card.name}</span>
          {showAttribute && <AttributeBadge attribute={card.attribute} />}
        </div>
        <div className="gf-large-card-power">
          {largeCardPower(card)}
          {typeof card.price === "number" && card.price > 0 && (
            <span className="gf-large-card-price"> ￥{card.price}</span>
          )}
        </div>
        <div className="gf-large-card-desc">{card.description}</div>
      </div>
    </div>
  );
}

/**
 * 場に置かれたカード（LargeCard）のパワー表記。
 * 手札の `shortPower` と整合させる。
 */
export function largeCardPower(card: CardDefinition): string {
  if (card.category === "trade") return card.name;
  if (card.category === "party") return "入党";
  if (card.category === "miracle") return `MP${card.mpCost ?? 0}`;
  const amount = card.effects.find(
    (effect) => typeof effect.amount === "number",
  )?.amount;
  if (card.category === "shield") return `守${amount ?? ""}`;
  if (card.effects.some((effect) => effect.kind === "mpRecover")) {
    return `MP+${amount ?? ""}`;
  }
  if (card.effects.some((effect) => effect.kind === "heal")) {
    return `HP+${amount ?? ""}`;
  }
  // `[].every(...)` は true になるため、空 effects を攻撃扱いしない。
  if (
    card.effects.length > 0 &&
    card.effects.every((effect) => effect.kind === "attack_power")
  ) {
    return `攻+${amount ?? ""}`;
  }
  if (card.effects.length === 0) return card.name;
  return `攻${amount ?? ""}`;
}
