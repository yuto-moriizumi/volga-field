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
    </button>
  );
}

function shortPower(card: NonNullable<ReturnType<typeof findCard>>): string {
  const amount = card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  if (card.category === "shield") return `守${amount ?? ""}`;
  if (card.category === "miracle") return `MP${card.mpCost ?? 0}`;
  if (card.effects.some((effect) => effect.kind === "heal")) return `癒${amount ?? ""}`;
  return `攻${amount ?? ""}`;
}
