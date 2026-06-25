"use client";

import type { GameState, PlayerState } from "@volga/shared";
import { NamePlate } from "./NamePlate";
import { LargeCard } from "./LargeCard";

export function TargetArea({
  pending,
  pendingBuy,
  pendingSell,
  targetPlayer,
  hitFlash,
}: {
  pending: GameState["pendingAttack"];
  pendingBuy: GameState["pendingBuy"];
  pendingSell: GameState["pendingSell"];
  targetPlayer: PlayerState | null;
  hitFlash: { amount: number; key: number } | null;
}) {
  return (
    <div className="gf-target-area" aria-label="ターゲットエリア">
      <NamePlate
        label={pending ? "攻撃対象" : pendingBuy ? "購入対象" : pendingSell ? "売却対象" : "ターゲット"}
        name={targetPlayer?.name ?? "未選択"}
        tone="blue"
      />
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
        {hitFlash && (
          <div key={hitFlash.key} className="gf-hit-flash">
            <strong>{hitFlash.amount}</strong>
            <span>ダメージ</span>
          </div>
        )}
      </div>
    </div>
  );
}
