"use client";

import type { GameState, PlayerState } from "@volga/shared";
import type { BattleEvent } from "./battleEvents";
import { NamePlate } from "./NamePlate";
import { LargeCard } from "./LargeCard";

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
}: {
  pending: GameState["pendingAttack"];
  pendingBuy: GameState["pendingBuy"];
  pendingSell: GameState["pendingSell"];
  targetPlayer: PlayerState | null;
  effect: TargetBattleEffect | null;
}) {
  const damageEffect =
    effect?.event.kind === "damage" ? effect.event : null;
  const showHit = Boolean(damageEffect && !damageEffect.blocked);

  return (
    <div className="gf-target-area" aria-label="ターゲットエリア">
      <NamePlate
        label={pending ? "攻撃対象" : pendingBuy ? "購入対象" : pendingSell ? "売却対象" : "ターゲット"}
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
        </div>
      </div>
    </div>
  );
}
