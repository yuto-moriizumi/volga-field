"use client";

import type { CardRef, GameState, PlayerState } from "@volga/shared";
import { NamePlate } from "./NamePlate";
import { LargeCard } from "./LargeCard";

export function SourceArea({
  activePlayer,
  selectedCards,
  discardMode,
  sellMode,
  confirmLabel,
  confirmDisabled,
  canEndTurn,
  canPassDefense,
  pendingBuy,
  canAffordPendingBuy,
  onConfirm,
  onAcceptBuy,
  onDeclineBuy,
}: {
  activePlayer: PlayerState | null;
  selectedCards: CardRef[];
  discardMode: boolean;
  sellMode: boolean;
  confirmLabel: string;
  confirmDisabled: boolean;
  canEndTurn: boolean;
  canPassDefense: boolean;
  pendingBuy: GameState["pendingBuy"];
  canAffordPendingBuy: boolean;
  onConfirm: () => void;
  onAcceptBuy: () => void;
  onDeclineBuy: () => void;
}) {
  if (pendingBuy) {
    return (
      <div className="gf-source-area" aria-label="ソースエリア">
        <div className="gf-status-stack">
          <NamePlate label="買う" name={activePlayer?.name ?? "?"} tone="teal" />
          <div className="gf-buy-status">￥{pendingBuy.price}</div>
        </div>
      <div className="gf-buy-decision">
        <button
          type="button"
          className={`gf-buy-accept${canAffordPendingBuy ? " is-default" : " is-disabled"}`}
          onClick={onAcceptBuy}
          disabled={!canAffordPendingBuy}
          aria-label="買う"
        >
          買う
        </button>
        <button
          type="button"
          className={`gf-buy-decline${canAffordPendingBuy ? "" : " is-default"}`}
          onClick={onDeclineBuy}
          aria-label="買わない"
        >
          買わない
        </button>
      </div>
      </div>
    );
  }
  return (
    <div className="gf-source-area" aria-label="ソースエリア">
      <div className="gf-status-stack">
        <NamePlate label="ターン" name={activePlayer?.name ?? "?"} tone="teal" />
        {discardMode && <div className="gf-discard-status">カードを捨てる</div>}
        {sellMode && <div className="gf-discard-status">カードを売る</div>}
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
        ) : sellMode ? (
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
