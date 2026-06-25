"use client";

import type { GameState, PlayerState } from "@volga/shared";
import { NamePlate } from "./NamePlate";

export function TargetArea({
  pending,
  targetPlayer,
  hitFlash,
}: {
  pending: GameState["pendingAttack"];
  targetPlayer: PlayerState | null;
  hitFlash: { amount: number; key: number } | null;
}) {
  return (
    <div className="gf-target-area" aria-label="ターゲットエリア">
      <NamePlate
        label={pending ? "攻撃対象" : "ターゲット"}
        name={targetPlayer?.name ?? "未選択"}
        tone="blue"
      />
      <div className="gf-action-stage">
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
