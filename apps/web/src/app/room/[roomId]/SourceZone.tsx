"use client";

import type { CardRef, PlayerState } from "@volga/shared";
import { NamePlate } from "./NamePlate";
import { LargeCard } from "./LargeCard";

export function SourceZone({
  activePlayer,
  selectedCards,
  discardMode,
  confirmLabel,
  confirmDisabled,
  canEndTurn,
  canPassDefense,
  onConfirm,
}: {
  activePlayer: PlayerState | null;
  selectedCards: CardRef[];
  discardMode: boolean;
  confirmLabel: string;
  confirmDisabled: boolean;
  canEndTurn: boolean;
  canPassDefense: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="gf-source-zone" aria-label="ソースゾーン">
      <div className="gf-status-stack">
        <NamePlate label="ターン" name={activePlayer?.name ?? "?"} tone="teal" />
        {discardMode && <div className="gf-discard-status">カードを捨てる</div>}
      </div>
      <button
        type="button"
        className="gf-confirm-zone"
        onClick={onConfirm}
        disabled={confirmDisabled}
        aria-label={confirmLabel}
      >
        {selectedCards.length > 0 ? (
          <div className="gf-confirm-card-stack">
            {selectedCards.map((card, idx) => (
              <LargeCard key={`${card.id}-${idx}`} cardRef={card} />
            ))}
          </div>
        ) : discardMode ? (
          <span className="gf-confirm-empty-action is-danger">{confirmLabel}</span>
        ) : canEndTurn ? (
          <span className="gf-confirm-empty-action">ターン終了</span>
        ) : canPassDefense ? (
          <span className="gf-confirm-empty-action is-danger">許す</span>
        ) : (
          <span className="gf-confirm-placeholder" />
        )}
      </button>
    </div>
  );
}
