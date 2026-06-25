"use client";

import { findCard } from "@volga/game-core";
import type { CardRef, PlayerState } from "@volga/shared";
import { CardView } from "./CardView";

interface HandAreaProps {
  me: PlayerState | null;
  canAct: boolean;
  isDefending: boolean;
  selectedCardIdx: number | null;
  selectedDefenseIdxes: number[];
  discardMode: boolean;
  selectedDiscardIdxes: number[];
  onPlayCard: (idx: number) => void;
  onHoverCard: (card: CardRef) => void;
  onSelectDefense: (idx: number) => void;
  onSelectDiscard: (idx: number) => void;
  onToggleDiscardMode: () => void;
}

export function HandArea({
  me,
  canAct,
  isDefending,
  selectedCardIdx,
  selectedDefenseIdxes,
  discardMode,
  selectedDiscardIdxes,
  onPlayCard,
  onHoverCard,
  onSelectDefense,
  onSelectDiscard,
  onToggleDiscardMode,
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
          return (
            <CardView
              key={`${card.id}-${idx}`}
              cardRef={card}
              selected={
                selectedCardIdx === idx ||
                selectedDefenseIdxes.includes(idx) ||
                selectedDiscardIdxes.includes(idx)
              }
              playable={
                discardMode
                  ? canDiscardCard
                  : isDefending
                    ? !isLearned && isDefenseCard(card.id)
                    : canPlayCard
              }
              learned={isLearned}
              onHover={() => onHoverCard(card)}
              onClick={() => {
                if (discardMode) {
                  if (canDiscardCard) onSelectDiscard(idx);
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
        <button
          type="button"
          className="gf-btn gf-discard-mode-btn"
          onClick={onToggleDiscardMode}
        >
          {discardMode ? "キャンセル" : "カードを捨てる"}
        </button>
      )}
    </section>
  );
}

function isDefenseCard(cardId: string): boolean {
  return findCard(cardId)?.effects.some((effect) => effect.kind === "defense") ?? false;
}

function isDefenseOnlyCard(cardId: string): boolean {
  const card = findCard(cardId);
  return card ? card.effects.every((effect) => effect.kind === "defense") : false;
}

function playableCards(player: PlayerState): { id: string }[] {
  return [...player.hand, ...player.learnedMiracles];
}
