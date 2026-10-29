"use client";

import { findCard } from "@volga/game-core";
import type { CardRef } from "@volga/shared";
import { AttributeBadge } from "../../attributes";

interface CardViewProps {
  cardRef: CardRef;
  selected?: boolean;
  playable?: boolean;
  hidden?: boolean;
  learned?: boolean;
  /** 防御ステップで選べない理由（属性不一致・防御不可）。指定時は打消し表示を出す。 */
  blockedLabel?: string;
  onClick?: () => void;
  onHover?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; ink: string; chip: string }> = {
  weapon: { bg: "#fde2d4", ink: "#7a2b1d", chip: "#d96b3e" },
  shield: { bg: "#d9eaf7", ink: "#1d4a72", chip: "#3b82c4" },
  miracle: { bg: "#e8dffa", ink: "#4a2e87", chip: "#8b5cf6" },
  trade: { bg: "#fde7f1", ink: "#7a1d4d", chip: "#c66b8a" },
  misc: { bg: "#e3f1f6", ink: "#1b4a5a", chip: "#3a8aa6" },
  party: { bg: "#fff5d6", ink: "#6b4a13", chip: "#d8a64a" },
};

export function CardView({
  cardRef,
  selected,
  playable,
  hidden,
  learned,
  blockedLabel,
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

  const tone = CATEGORY_COLORS[card.category] ?? CATEGORY_COLORS.misc!;
  void tone.chip;
  const blocked = Boolean(blockedLabel);
  // 場の LargeCard と同じ基準: 武器と盾は無属性でも出す。
  const showAttribute =
    card.category === "weapon" ||
    card.category === "shield" ||
    card.attribute !== "none";

  return (
    <button
      type="button"
      className="gf-hand-card"
      onClick={playable ? onClick : undefined}
      onFocus={onHover}
      onPointerEnter={onHover}
      aria-disabled={!playable}
      data-selected={selected}
      data-playable={playable ? "true" : "false"}
      data-blocked={blocked ? "true" : undefined}
      title={blocked ? blockedLabel : undefined}
      style={{
        background: playable ? tone.bg : undefined,
        borderColor: selected ? tone.chip : undefined,
        color: playable ? tone.ink : undefined,
        cursor: playable ? "pointer" : "default",
      }}
    >
      <span className="gf-hand-attr">
        {showAttribute && <AttributeBadge attribute={card.attribute} short />}
      </span>
      <div className="gf-hand-card-art">{card.emoji}</div>
      <div className="gf-hand-card-caption">
        <span>{shortPower(card)}</span>
        {learned && <small>習</small>}
      </div>
      {typeof card.price === "number" && card.price > 0 && (
        <div className="gf-hand-card-price">￥{card.price}</div>
      )}
      {blocked && (
        <span className="gf-hand-card-blocked">
          <span className="gf-hand-card-blocked-mark" aria-hidden="true">
            ×
          </span>
          <span className="gf-hand-card-blocked-label">{blockedLabel}</span>
        </span>
      )}
    </button>
  );
}

export function shortPower(card: NonNullable<ReturnType<typeof findCard>>): string {
  if (card.category === "trade") return card.name;
  if (card.category === "party") return "入党";
  const amount = card.effects.find((effect) => typeof effect.amount === "number")?.amount;
  if (card.category === "shield") return `守${amount ?? ""}`;
  if (card.category === "miracle") return `MP${card.mpCost ?? 0}`;
  if (card.effects.some((effect) => effect.kind === "heal")) return `癒${amount ?? ""}`;
  if (card.effects.some((effect) => effect.kind === "mpRecover")) return `MP+${amount ?? ""}`;
  if (
    card.effects.length > 0 &&
    card.effects.every((effect) => effect.kind === "attack_power")
  ) {
    return `攻+${amount ?? ""}`;
  }
  if (card.effects.length === 0) return card.name;
  return `攻${amount ?? ""}`;
}
