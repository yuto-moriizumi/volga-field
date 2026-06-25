"use client";

import { findCard } from "@volga/game-core";
import type { CardRef, PlayerState } from "@volga/shared";
import { CardView } from "./CardView";

interface HandAreaProps {
  me: PlayerState | null;
  canAct: boolean;
  isDefending: boolean;
  selectedCardIdxes: number[];
  selectedDefenseIdxes: number[];
  discardMode: boolean;
  sellMode: boolean;
  selectedSellIdxes: number[];
  selectedDiscardIdxes: number[];
  onPlayCard: (idx: number) => void;
  onHoverCard: (card: CardRef) => void;
  onSelectDefense: (idx: number) => void;
  onSelectDiscard: (idx: number) => void;
  onSelectSell: (idx: number) => void;
  onToggleDiscardMode: () => void;
  onToggleSellMode: () => void;
}

export function HandArea({
  me,
  canAct,
  isDefending,
  selectedCardIdxes,
  selectedDefenseIdxes,
  discardMode,
  sellMode,
  selectedSellIdxes,
  selectedDiscardIdxes,
  onPlayCard,
  onHoverCard,
  onSelectDefense,
  onSelectDiscard,
  onSelectSell,
  onToggleDiscardMode,
  onToggleSellMode,
}: HandAreaProps) {
  if (!me) return <div />;
  const cards = playableCards(me);
  return (
    <section className="gf-hand-area" aria-label="手札エリア">
      <div className="gf-hand-strip">
        {cards.length === 0 && <div className="gf-empty-hand">手札がない…</div>}
        {cards.map((card, idx) => {
          const definition = findCard(card.id);
          const isLearned = idx >= me.hand.length;
          const hasEnoughMp = !definition?.mpCost || me.mp >= definition.mpCost;
          const canPlayCard = canAct && hasEnoughMp && !isDefenseOnlyCard(card.id);
          const canDiscardCard = discardMode && !isLearned && !isTradeCard(card.id);
          const canSellCard =
            sellMode && !isLearned && !isSellCardItself(card.id) && !isBuyCardItself(card.id);
          return (
            <CardView
              key={`${card.id}-${idx}`}
              cardRef={card}
              selected={
                selectedCardIdxes.includes(idx) ||
                selectedDefenseIdxes.includes(idx) ||
                selectedDiscardIdxes.includes(idx) ||
                selectedSellIdxes.includes(idx)
              }
              playable={
                discardMode
                  ? canDiscardCard
                  : sellMode
                    ? canSellCard
                    : isDefending
                      ? !isLearned && isDefenseCard(card.id)
                      : canPlayCard
              }
              learned={isLearned}
              onHover={() => onHoverCard(card)}
              onClick={() => {
                if (discardMode) {
                  if (canDiscardCard) onSelectDiscard(idx);
                } else if (sellMode) {
                  if (canSellCard) onSelectSell(idx);
                } else if (isDefending) {
                  if (!isLearned) onSelectDefense(idx);
                } else if (canPlayCard) {
                  onPlayCard(idx);
                }
              }}
            />
          );
        })}
      </div>
      {canAct && !isDefending && (
        <div className="gf-hand-buttons">
          <button
            type="button"
            className={`gf-btn gf-discard-mode-btn${discardMode ? " is-active" : ""}`}
            onClick={onToggleDiscardMode}
            disabled={sellMode}
          >
            {discardMode ? "キャンセル" : "カードを捨てる"}
          </button>
          {hasSellCard(me) && (
            <button
              type="button"
              className={`gf-btn gf-sell-mode-btn${sellMode ? " is-active" : ""}`}
              onClick={onToggleSellMode}
              disabled={discardMode}
            >
              {sellMode ? "キャンセル" : "カードを売る"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function isDefenseCard(cardId: string): boolean {
  return findCard(cardId)?.effects.some((effect) => effect.kind === "defense") ?? false;
}

function isDefenseOnlyCard(cardId: string): boolean {
  const card = findCard(cardId);
  if (!card) return false;
  if (card.effects.length === 0) return false;
  return card.effects.every((effect) => effect.kind === "defense");
}

function isTradeCard(cardId: string): boolean {
  return cardId === "buy" || cardId === "sell";
}

function isSellCardItself(cardId: string): boolean {
  return cardId === "sell";
}

function isBuyCardItself(cardId: string): boolean {
  return cardId === "buy";
}

function hasSellCard(player: PlayerState): boolean {
  return player.hand.some((c) => c.id === "sell");
}

function playableCards(player: PlayerState): { id: string }[] {
  return [...player.hand, ...player.learnedMiracles];
}
