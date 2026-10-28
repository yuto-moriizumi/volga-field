"use client";

import type { CardRef, GameState, PlayerState } from "@volga/shared";
import { findCard } from "@volga/game-core";
import { NamePlate } from "./NamePlate";
import { LargeCard } from "./LargeCard";
import { DuelCardView, PartyActionCard, PartyAnnouncer } from "./DuelStage";
import type { DuelPresentation, PartyPresentation } from "./battleSequence";

export function SourceArea({
  activePlayer,
  selectedCards,
  isDefending,
  incomingAttack,
  discardMode,
  sellMode,
  exchangeMode,
  exchangeDraft,
  confirmLabel,
  confirmDisabled,
  canEndTurn,
  pendingBuy,
  canAffordPendingBuy,
  duel,
  party,
  onConfirm,
  onAcceptBuy,
  onDeclineBuy,
  onAdjustExchange,
}: {
  activePlayer: PlayerState | null;
  selectedCards: CardRef[];
  isDefending: boolean;
  incomingAttack: GameState["pendingAttack"];
  discardMode: boolean;
  sellMode: boolean;
  exchangeMode: boolean;
  exchangeDraft: ExchangeDraft | null;
  confirmLabel: string;
  confirmDisabled: boolean;
  canEndTurn: boolean;
  pendingBuy: GameState["pendingBuy"];
  canAffordPendingBuy: boolean;
  duel: DuelPresentation | null;
  party: PartyPresentation | null;
  onConfirm: () => void;
  onAcceptBuy: () => void;
  onDeclineBuy: () => void;
  onAdjustExchange: (stat: "mp" | "money", delta: number) => void;
}) {
  // A party acting on its own borrows the left field for a beat: the owner's
  // name on the plate and the action shown as a card. Nothing is selectable.
  if (party) {
    return (
      <div className="gf-source-area" aria-label="政党の場" data-party-stage="card">
        <div className="gf-status-stack">
          <NamePlate
            label="政党"
            name={party.actorName}
            tone="teal"
            playerId={party.actorId}
            dataStep="party-owner"
          />
        </div>
        <div className="gf-duel-slot is-filled" data-step="party-card">
          <PartyActionCard party={party} />
        </div>
        <PartyAnnouncer party={party} />
      </div>
    );
  }
  // During a duel the left field belongs to the attacker: empty at first, then
  // the card that was played. No controls live here until the sequence ends.
  if (duel) {
    // `attackCards` carries every card played at once (weapon + power-ups) in
    // play order; fall back to the single card for older presentations.
    const attackCards =
      duel.attackCards.length > 0 ? duel.attackCards : [duel.attackCard];
    return (
      <div
        className="gf-source-area"
        aria-label="攻撃側の場"
        data-duel-stage={duel.stage}
      >
        <div className="gf-status-stack">
          {/* The attacker stays named while the field is still empty: whose
              turn it is never changes mid-duel, and the name blinking out and
              back reads as a glitch. */}
          <NamePlate
            label="攻撃"
            name={duel.attackerName}
            tone="teal"
            playerId={duel.attackerId}
            dataStep={duel.showAttackCard ? "attacker-name" : undefined}
          />
        </div>
        {duel.showAttackCard ? (
          <div className="gf-duel-slot is-filled" data-step="attack-card">
            <div
              className="gf-duel-attack-stack"
              data-count={Math.min(attackCards.length, 4)}
              role="group"
              aria-label={
                attackCards.length > 1
                  ? `攻撃カード${attackCards.length}枚`
                  : "攻撃カード"
              }
            >
              {attackCards.map((card, index) => (
                <DuelCardView
                  key={`${card.id ?? card.name}-${index}`}
                  card={card}
                  tone="attack"
                />
              ))}
            </div>
            {duel.attackAmount !== null && duel.attackAmount > 0 && (
              <div className="gf-duel-power">攻{duel.attackAmount}</div>
            )}
          </div>
        ) : (
          <div className="gf-duel-slot" aria-hidden="true" />
        )}
      </div>
    );
  }
  if (isDefending) {
    return (
      <div className="gf-source-area" aria-label="相手のフィールド">
        <div className="gf-status-stack">
          <NamePlate
            label="攻撃"
            name={activePlayer?.name ?? "?"}
            tone="teal"
            playerId={activePlayer?.id}
          />
        </div>
        <div className="gf-incoming-attack" aria-label="相手の攻撃カード">
          {incomingAttack && (
            <>
              <LargeCard cardRef={incomingAttack.card} />
              {incomingAttack.cardName !== findCard(incomingAttack.card.id)?.name && (
                <div className="gf-incoming-attack-name">
                  {incomingAttack.cardName}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
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
  if (exchangeMode && activePlayer && exchangeDraft) {
    return (
      <ExchangePanel
        player={activePlayer}
        draft={exchangeDraft}
        onAdjust={onAdjustExchange}
        onConfirm={onConfirm}
      />
    );
  }
  return (
    <div className="gf-source-area" aria-label="ソースエリア">
      <div className="gf-status-stack">
        <NamePlate
          label="ターン"
          name={activePlayer?.name ?? "?"}
          tone="teal"
          playerId={activePlayer?.id}
          active
        />
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
        ) : (
          <span className="gf-confirm-placeholder" />
        )}
      </button>
    </div>
  );
}

export interface ExchangeDraft {
  hp: number;
  mp: number;
  money: number;
}

function ExchangePanel({
  player,
  draft,
  onAdjust,
  onConfirm,
}: {
  player: PlayerState;
  draft: ExchangeDraft;
  onAdjust: (stat: "mp" | "money", delta: number) => void;
  onConfirm: () => void;
}) {
  const mpDelta = draft.mp - player.mp;
  const moneyDelta = draft.money - player.money;
  const hpCost = mpDelta + moneyDelta;
  const projectedHp = player.hp - hpCost;
  const canIncreaseMp = projectedHp >= 1;
  const canIncreaseMoney = projectedHp >= 1;
  const canDecreaseMp = draft.mp >= 1;
  const canDecreaseMoney = draft.money >= 1;
  const canIncreaseMp10 = projectedHp >= 10;
  const canIncreaseMoney10 = projectedHp >= 10;
  const canDecreaseMp10 = draft.mp >= 10;
  const canDecreaseMoney10 = draft.money >= 10;
  const hasChanges = mpDelta !== 0 || moneyDelta !== 0;
  const isValid = projectedHp >= 0 && hasChanges;

  return (
    <div className="gf-source-area" aria-label="ソースエリア">
      <div className="gf-status-stack">
        <NamePlate label="両替" name={player.name} tone="teal" />
        <div className="gf-buy-status">HP ⇄ MP / ￥</div>
      </div>
      <div className="gf-exchange-panel">
        <ExchangeBar
          label="HP"
          icon="❤"
          current={player.hp}
          target={draft.hp}
          tone="hp"
          buttons={null}
        />
        <ExchangeBar
          label="MP"
          icon="🔵"
          current={player.mp}
          target={draft.mp}
          tone="mp"
          buttons={{
            onPlus: () => onAdjust("mp", +1),
            onPlus10: () => onAdjust("mp", +10),
            onMinus: () => onAdjust("mp", -1),
            onMinus10: () => onAdjust("mp", -10),
            canPlus: canIncreaseMp,
            canPlus10: canIncreaseMp10,
            canMinus: canDecreaseMp,
            canMinus10: canDecreaseMp10,
          }}
        />
        <ExchangeBar
          label="￥"
          icon="💰"
          current={player.money}
          target={draft.money}
          tone="money"
          buttons={{
            onPlus: () => onAdjust("money", +1),
            onPlus10: () => onAdjust("money", +10),
            onMinus: () => onAdjust("money", -1),
            onMinus10: () => onAdjust("money", -10),
            canPlus: canIncreaseMoney,
            canPlus10: canIncreaseMoney10,
            canMinus: canDecreaseMoney,
            canMinus10: canDecreaseMoney10,
          }}
        />
        <button
          type="button"
          className="gf-confirm-zone gf-exchange-confirm"
          onClick={onConfirm}
          disabled={!isValid}
          aria-label="両替を確定"
        >
          <span className="gf-confirm-empty-action">両替を確定</span>
        </button>
      </div>
    </div>
  );
}

interface ExchangeBarProps {
  label: string;
  icon: string;
  current: number;
  target: number;
  tone: "hp" | "mp" | "money";
  buttons: {
    onPlus: () => void;
    onPlus10: () => void;
    onMinus: () => void;
    onMinus10: () => void;
    canPlus: boolean;
    canPlus10: boolean;
    canMinus: boolean;
    canMinus10: boolean;
  } | null;
}

function ExchangeBar({ label, icon, current, target, tone, buttons }: ExchangeBarProps) {
  const changed = current !== target;
  return (
    <div className={`gf-exchange-bar tone-${tone}${changed ? " is-changed" : ""}`}>
      {buttons && (
        <div className="gf-exchange-buttons">
          <button
            type="button"
            className="gf-exchange-btn"
            onClick={buttons.onPlus10}
            disabled={!buttons.canPlus10}
            aria-label={`${label}を10増やす`}
          >
            +10
          </button>
          <button
            type="button"
            className="gf-exchange-btn"
            onClick={buttons.onPlus}
            disabled={!buttons.canPlus}
            aria-label={`${label}を1増やす`}
          >
            +1
          </button>
        </div>
      )}
      <div className="gf-exchange-bar-display">
        <span className="gf-exchange-icon" aria-hidden="true">{icon}</span>
        <span className="gf-exchange-label">{label}</span>
        <span className="gf-exchange-current">{current}</span>
        <span className="gf-exchange-arrow" aria-hidden="true">→</span>
        <span className="gf-exchange-target">{target}</span>
      </div>
      {buttons && (
        <div className="gf-exchange-buttons">
          <button
            type="button"
            className="gf-exchange-btn"
            onClick={buttons.onMinus}
            disabled={!buttons.canMinus}
            aria-label={`${label}を1減らす`}
          >
            -1
          </button>
          <button
            type="button"
            className="gf-exchange-btn"
            onClick={buttons.onMinus10}
            disabled={!buttons.canMinus10}
            aria-label={`${label}を10減らす`}
          >
            -10
          </button>
        </div>
      )}
    </div>
  );
}