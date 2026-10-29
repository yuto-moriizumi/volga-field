"use client";

import type { CardAttribute, CardRef, GameState, PlayerState } from "@volga/shared";
import { AttributeBadge, attributeLabel, attackDefenseRule } from "../../attributes";
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
  PartyImpactView,
} from "./DuelStage";
import type { PartyPresentation } from "./battleSequence";

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
  party,
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
  party: PartyPresentation | null;
  onConfirmDefense: () => void;
}) {
  // Party actions target someone too: the name plate and the effect sit on the
  // right while the action card is on the left.
  if (party) {
    const hit = party.effect.kind === "damage" || party.effect.kind === "steal";
    return (
      <div className="gf-target-area" aria-label="政党行動の対象" data-party-stage="target">
        <NamePlate
          label="対象"
          name={party.targetName}
          tone="blue"
          playerId={party.targetId ?? undefined}
          flash={hit}
          dataStep="party-target"
        />
        <div className="gf-stage-wrap" data-hit={hit ? "true" : undefined}>
          <div className="gf-action-stage gf-duel-stage">
            <PartyImpactView party={party} />
          </div>
        </div>
      </div>
    );
  }
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
        {duel.awaitingDefense && (
          <IncomingAttributeNote attribute={pending?.attribute} />
        )}
        <div className="gf-stage-wrap" data-hit={hit ? "true" : undefined}>
          <div className="gf-action-stage gf-duel-stage">
            {duel.awaitingDefense && (
              <DefenseZone
                attackAttribute={pending?.attribute}
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
      {isDefending && <IncomingAttributeNote attribute={pending?.attribute} />}
      <div
        key={effect && damageEffect ? effect.key : "target-stage"}
        className="gf-stage-wrap"
        data-hit={showHit ? "true" : undefined}
      >
        <div className="gf-action-stage">
          {isDefending ? (
            <DefenseZone
              attackAttribute={pending?.attribute}
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

function IncomingAttributeNote({
  attribute,
}: {
  attribute: CardAttribute | undefined;
}) {
  const blocked = (attribute ?? "none") === "environmentalism";
  return (
    <div
      className={`gf-target-attr${blocked ? " is-blocked" : ""}`}
      role="note"
      aria-label={`攻撃属性 ${attributeLabel(attribute)} ${attackDefenseRule(attribute)}`}
    >
      <span className="gf-target-attr-label">攻撃</span>
      <AttributeBadge attribute={attribute} />
      <span>{attackDefenseRule(attribute)}</span>
    </div>
  );
}

function DefenseZone({
  attackAttribute,
  defenseCards,
  defensePower,
  disabled,
  onConfirm,
}: {
  attackAttribute: CardAttribute | undefined;
  defenseCards: CardRef[];
  defensePower: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const blockable = (attackAttribute ?? "none") !== "environmentalism";
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
          <span className={`gf-defense-hint${blockable ? "" : " is-blocked"}`}>
            {blockable
              ? "防御カードを選ぶか、ここを押して攻撃を通す"
              : "属性により防御できません。ここを押して攻撃を通す"}
          </span>
        </>
      )}
    </button>
  );
}
