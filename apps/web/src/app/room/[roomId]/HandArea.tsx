"use client";

import { canDefendAttribute, findCard, getCardAttribute } from "@volga/game-core";
import type { CardAttribute, CardRef, PlayerState } from "@volga/shared";
import { CardView } from "./CardView";

interface HandAreaProps {
  me: PlayerState | null;
  canAct: boolean;
  isDefending: boolean;
  /** 防御する攻撃の属性。undefined は無属性。 */
  attackAttribute?: CardAttribute;
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
  attackAttribute,
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
          const canDiscardCard = discardMode && !isLearned;
          const canSellCard =
            sellMode && !isLearned && !isSellCardItself(card.id) && !isBuyCardItself(card.id);
          // 防御では、攻撃属性を防げる盾だけを選べる。
          const canDefendCard =
            isDefending &&
            !isLearned &&
            isDefenseCard(card.id) &&
            canDefendAttribute(getCardAttribute(card.id), attackAttribute ?? "none");
          // 防御中に選べない理由をカード自体に出す（色だけに頼らない）。
          const blockedLabel = !isDefending || canDefendCard
            ? undefined
            : isDefenseCard(card.id)
              ? "属性不一致"
              : "防御不可";
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
                      ? canDefendCard
                      : canPlayCard
              }
              learned={isLearned}
              blockedLabel={blockedLabel}
              onHover={() => onHoverCard(card)}
              onClick={() => {
                if (discardMode) {
                  if (canDiscardCard) onSelectDiscard(idx);
                } else if (sellMode) {
                  if (canSellCard) onSelectSell(idx);
                } else if (isDefending) {
                  if (canDefendCard) onSelectDefense(idx);
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
