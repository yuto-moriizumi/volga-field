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
}: CardViewProps) {
  if (hidden || cardRef.id === "hidden") {
    return (
      <div
        style={{
          width: 104,
          height: 148,
          background:
            "repeating-linear-gradient(45deg, #4ca89b 0 8px, #3a8a7e 8px 16px)",
          borderRadius: 12,
          border: "3px solid #1f5b50",
          boxShadow: "0 3px 0 rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          color: "#fff",
        }}
      >
        ?
      </div>
    );
  }

  const card = findCard(cardRef.id);
  if (!card) {
    return (
      <div
        style={{
          width: 104,
          height: 148,
          background: "#eef4cc",
          borderRadius: 12,
          border: "2px solid #2f7568",
        }}
      />
    );
  }

  const tone = CATEGORY_COLORS[card.category] ?? CATEGORY_COLORS.special!;
  void tone.chip;

  return (
    <button
      onClick={onClick}
      disabled={!playable}
      style={{
        width: 104,
        height: 148,
        background: playable ? tone.bg : "#d6d6c8",
        borderRadius: 12,
        border: `3px solid ${selected ? tone.chip : "#2f7568"}`,
        boxShadow: selected
          ? `0 0 0 3px ${tone.chip}55, 0 6px 0 rgba(0,0,0,0.2)`
          : "0 3px 0 rgba(0,0,0,0.2)",
        transform: selected ? "translateY(-10px)" : "none",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        color: tone.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "space-between",
        padding: 6,
        cursor: playable ? "pointer" : "default",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.05em",
          color: tone.chip,
        }}
      >
        {categoryLabel(card.category)}
        {learned ? " / 習得" : ""}
      </div>
      <div style={{ fontSize: 38, lineHeight: 1 }}>{card.emoji}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 900 }}>{card.name}</div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            opacity: 0.8,
            lineHeight: 1.15,
            marginTop: 2,
          }}
        >
          {card.description}
        </div>
      </div>
    </button>
  );
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case "weapon":
      return "武器";
    case "shield":
      return "盾";
    case "potion":
      return "薬";
    case "miracle":
      return "奇跡";
    case "special":
      return "特殊";
    default:
      return cat;
  }
}
