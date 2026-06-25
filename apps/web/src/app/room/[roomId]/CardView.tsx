"use client";

import { findCard } from "@volga/game-core";
import type { CardRef } from "@volga/shared";

interface CardViewProps {
  cardRef: CardRef;
  selected?: boolean;
  playable?: boolean;
  hidden?: boolean;
  learned?: boolean;
  onClick?: () => void;
  onHover?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; ink: string; chip: string }> = {
  weapon: { bg: "#fde2d4", ink: "#7a2b1d", chip: "#d96b3e" },
  shield: { bg: "#d9eaf7", ink: "#1d4a72", chip: "#3b82c4" },
  potion: { bg: "#dff3df", ink: "#1d5a32", chip: "#3a9b59" },
  miracle: { bg: "#e8dffa", ink: "#4a2e87", chip: "#8b5cf6" },
  special: { bg: "#fbeac9", ink: "#7a4d10", chip: "#e0a93e" },
  trade: { bg: "#fde7f1", ink: "#7a1d4d", chip: "#c66b8a" },
  colorless: { bg: "#ececec", ink: "#3a3a3a", chip: "#8a8a8a" },
  misc: { bg: "#e3f1f6", ink: "#1b4a5a", chip: "#3a8aa6" },
  party: { bg: "#fff5d6", ink: "#6b4a13", chip: "#d8a64a" },
};

export function CardView({
  cardRef,
  selected,
  playable,
  hidden,
  learned,
  onClick,
  onHover,
}: CardViewProps) {
  if (hidden || cardRef.id === "hidden") {
    return (
      <div
        className="gf-hand-card gf-hand-card-hidden"
      >
        ?
      </div>
    );
  }

  const card = findCard(cardRef.id);
  if (!card) {
    return (
      <div
        className="gf-hand-card"
      />
    );
  }

  const tone = CATEGORY_COLORS[card.category] ?? CATEGORY_COLORS.special!;
  void tone.chip;

  return (
    <button
      type="button"
      className="gf-hand-card"
      onClick={playable ? onClick : undefined}
      onFocus={onHover}
      onPointerEnter={onHover}
      aria-disabled={!playable}
      data-selected={selected}
      style={{
        background: playable ? tone.bg : "#d6d6c8",
        borderColor: selected ? tone.chip : undefined,
        color: tone.ink,
        cursor: playable ? "pointer" : "default",
      }}
    >
      <div className="gf-hand-card-art">{card.emoji}</div>
      <div className="gf-hand-card-caption">
        <span>{shortPower(card)}</span>
        {learned && <small>習</small>}
      </div>
      {typeof card.price === "number" && card.price > 0 && (
        <div className="gf-hand-card-price">￥{card.price}</div>
      )}
    </button>
  );
}

function shortPower(card: NonNullable<ReturnType<typeof findCard>>): string {
  if (card.category === "trade") return card.name;
  if (card.category === "party") return "入党";
  const amount = card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  if (card.category === "shield") return `守${amount ?? ""}`;
  if (card.category === "miracle") return `MP${card.mpCost ?? 0}`;
  if (card.effects.some((effect) => effect.kind === "heal")) return `癒${amount ?? ""}`;
  if (card.effects.some((effect) => effect.kind === "mpRecover")) return `MP+${amount ?? ""}`;
  if (card.effects.every((effect) => effect.kind === "attack_power")) {
    return `+${amount ?? ""}`;
  }
  return `攻${amount ?? ""}`;
}
