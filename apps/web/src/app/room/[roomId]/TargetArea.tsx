"use client";

import type { CardRef, GameState, PlayerState } from "@volga/shared";
import type { BattleEvent } from "./battleEvents";
import type { DuelPresentation } from "./battleSequence";
import { NamePlate } from "./NamePlate";
import { LargeCard } from "./LargeCard";
import {
  DuelAnnouncer,
  DuelDefenseView,
  DuelDrawChip,
  DuelEffectView,
  DuelTurnView,
} from "./DuelStage";

export interface TargetBattleEffect {
  event: BattleEvent;
  key: number;
}

export function TargetArea({
  pending,
  pendingBuy,
  pendingSell,
  targetPlayer,
  effect,
  isDefending,
  defenseCards,
  defensePower,
  defenseDisabled,
  duel,
  onConfirmDefense,
}: {
  pending: GameState["pendingAttack"];
  pendingBuy: GameState["pendingBuy"];
  pendingSell: GameState["pendingSell"];
  targetPlayer: PlayerState | null;
  effect: TargetBattleEffect | null;
  isDefending: boolean;
  defenseCards: CardRef[];
  defensePower: number;
  defenseDisabled: boolean;
  duel: DuelPresentation | null;
  onConfirmDefense: () => void;
}) {
  // The centre field carries the target name, the defense card and the effect
  // while a duel plays out. The name plate and the step content appear on their
  // own timer, so the field is empty until the name step.
  if (duel) {
    const hit =
      duel.showEffect && duel.effect !== null && !duel.effect.blocked;
    return (
      <div
        className="gf-target-area"
        aria-label="使用先の場"
        data-duel-stage={duel.stage}
      >
        <NamePlate
          label={duel.isSelfDefender ? "防御" : "使用先"}
          name={duel.showTargetName ? duel.defenderName : ""}
          tone="blue"
          playerId={duel.showTargetName ? duel.defenderId : undefined}
          flash={Boolean(duel.showEffect && duel.effect)}
          dataStep={duel.showTargetName ? "target-name" : undefined}
        />
        <div className="gf-stage-wrap" data-hit={hit ? "true" : undefined}>
          <div className="gf-action-stage gf-duel-stage">
            {duel.awaitingDefense && (
              <DefenseZone
                defenseCards={defenseCards}
                defensePower={defensePower}
                disabled={defenseDisabled}
                onConfirm={onConfirmDefense}
              />
            )}
            {duel.showDefense && duel.defenseCards && (
              <DuelDefenseView cards={duel.defenseCards} />
            )}
            {duel.showEffect && duel.effect && (
              <DuelEffectView
                effect={duel.effect}
                defenderName={duel.defenderName}
                recoil={duel.recoil}
                attackerName={duel.attackerName}
              />
            )}
            {duel.showTurn && duel.turn && <DuelTurnView turn={duel.turn} />}
            {duel.drawCount > 0 &&
              (duel.showTurn || (duel.showEffect && !duel.turn)) && (
                <DuelDrawChip count={duel.drawCount} />
              )}
          </div>
        </div>
        <DuelAnnouncer duel={duel} />
      </div>
    );
  }

  const damageEffect =
    effect?.event.kind === "damage" ? effect.event : null;
  const showHit = Boolean(damageEffect && !damageEffect.blocked);

  return (
    <div className="gf-target-area" aria-label="ターゲットエリア">
      <NamePlate
        label={
          isDefending
            ? "防御"
            : pending
              ? "攻撃対象"
              : pendingBuy
                ? "購入対象"
                : pendingSell
                  ? "売却対象"
                  : "ターゲット"
        }
        name={targetPlayer?.name ?? "未選択"}
        tone="blue"
        playerId={targetPlayer?.id}
        flash={Boolean(damageEffect)}
      />
      <div
        key={effect && damageEffect ? effect.key : "target-stage"}
        className="gf-stage-wrap"
        data-hit={showHit ? "true" : undefined}
      >
        <div className="gf-action-stage">
          {isDefending ? (
            <DefenseZone
              defenseCards={defenseCards}
              defensePower={defensePower}
              disabled={defenseDisabled}
              onConfirm={onConfirmDefense}
            />
          ) : (
            <>
              {pendingBuy && (
                <div className="gf-target-buy-card" aria-label="購入対象カード">
                  <div className="gf-buy-card-price">￥{pendingBuy.price}</div>
                  <LargeCard cardRef={pendingBuy.card} />
                </div>
              )}
              {pendingSell && (
                <div className="gf-target-sell-stack" aria-label="売却カード">
                  {pendingSell.cards.map((c, i) => (
                    <LargeCard key={`${c.id}-${i}`} cardRef={c} />
                  ))}
                  <div className="gf-sell-card-price">合計 ￥{pendingSell.price}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DefenseZone({
  defenseCards,
  defensePower,
  disabled,
  onConfirm,
}: {
  defenseCards: CardRef[];
  defensePower: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const label =
    defenseCards.length > 0
      ? `防御を確定（${defenseCards.length}枚 防${defensePower}）`
      : "許す（防御しない）";
  return (
    <button
      type="button"
      className="gf-defense-zone"
      onClick={onConfirm}
      disabled={disabled}
      aria-label={label}
      data-step="defense-zone"
    >
      {defenseCards.length > 0 ? (
        <>
          <div
            className="gf-confirm-card-stack gf-defense-card-stack"
            aria-label="選択中の防御カード"
          >
            {defenseCards.map((card, idx) => (
              <LargeCard key={`${card.id}-${idx}`} cardRef={card} />
            ))}
          </div>
          <div className="gf-defense-summary">
            {defenseCards.length}枚 防{defensePower}
          </div>
        </>
      ) : (
        <>
          <span className="gf-confirm-empty-action is-danger">許す</span>
          <span className="gf-defense-hint">
            防御カードを選ぶか、ここを押して攻撃を通す
          </span>
        </>
      )}
    </button>
  );
}
