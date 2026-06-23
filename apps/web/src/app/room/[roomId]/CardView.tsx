"use client";

import { BASE_CARDS, findCard } from "@volga/game-core";
import type { CardRef } from "@volga/shared";

interface CardViewProps {
  cardRef: CardRef;
  selected?: boolean;
  playable?: boolean;
  hidden?: boolean;
  onClick?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  weapon: "#dc2626",
  shield: "#3b82f6",
  potion: "#10b981",
  magic: "#8b5cf6",
  special: "#f59e0b",
};

export function CardView({
  cardRef,
  selected,
  playable,
  hidden,
  onClick,
}: CardViewProps) {
  if (hidden || cardRef.id === "hidden") {
    return (
      <div
        style={{
          width: 100,
          height: 140,
          background: "linear-gradient(135deg, #475569, #1e293b)",
          borderRadius: 8,
          border: "2px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
        }}
      >
        ❓
      </div>
    );
  }

  const card = findCard(cardRef.id);
  if (!card) {
    return (
      <div
        style={{
          width: 100,
          height: 140,
          background: "var(--panel-light)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ?
      </div>
    );
  }

  const color = CATEGORY_COLORS[card.category] ?? "#64748b";
  void BASE_CARDS;

  return (
    <button
      onClick={onClick}
      disabled={!playable}
      style={{
        width: 100,
        height: 140,
        background: playable
          ? `linear-gradient(180deg, ${color}33, var(--panel))`
          : "var(--panel-light)",
        borderRadius: 8,
        border: `2px solid ${selected ? color : "var(--border)"}`,
        boxShadow: selected ? `0 0 12px ${color}` : "none",
        transform: selected ? "translateY(-8px)" : "none",
        transition: "all 0.15s",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 8,
        cursor: playable ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 32 }}>{card.emoji}</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {card.name}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {card.description}
      </div>
    </button>
  );
}