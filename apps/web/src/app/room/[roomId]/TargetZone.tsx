"use client";

import type { GameState, PlayerState } from "@volga/shared";
import { NamePlate } from "./NamePlate";

export function TargetZone({
  pending,
  targetPlayer,
  hitFlash,
  canUseDiscard,
  discardMode,
  onToggleDiscardMode,
}: {
  pending: GameState["pendingAttack"];
  targetPlayer: PlayerState | null;
  hitFlash: { amount: number; key: number } | null;
  canUseDiscard: boolean;
  discardMode: boolean;
  onToggleDiscardMode: () => void;
}) {
  return (
    <div className="gf-target-zone" aria-label="ターゲットゾーン">
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
        {canUseDiscard && (
          <button
            className="gf-btn gf-discard-mode-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDiscardMode();
            }}
          >
            {discardMode ? "キャンセル" : "カードを捨てる"}
          </button>
        )}
      </div>
    </div>
  );
}
