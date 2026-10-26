"use client";

import { PARTY_LABELS, findCard } from "@volga/game-core";
import type { PlayerState } from "@volga/shared";
import { AnimatedNumber } from "./AnimatedNumber";
import { eventAffectsPlayer, type BattleEvent } from "./battleEvents";

interface NameListProps {
  players: PlayerState[];
  playerId: string | null;
  activePlayerId: string | null;
  activeEffect: BattleEvent | null;
  selectedTargetId: string | null;
  canSelect: boolean;
  onSelect: (playerId: string) => void;
}

export function NameList({
  players,
  playerId,
  activePlayerId,
  activeEffect,
  selectedTargetId,
  canSelect,
  onSelect,
}: NameListProps) {
  return (
    <div className="gf-name-list" aria-label="プレイヤー一覧">
      {players.map((p) => {
        const partyCard = p.party ? findCard(p.party) : null;
        const isActive = p.id === activePlayerId;
        const effect =
          activeEffect && eventAffectsPlayer(activeEffect, p.id)
            ? activeEffect
            : null;
        const effectClass =
          effect?.kind === "damage"
            ? effect.blocked
              ? " is-effect-blocked"
              : " is-effect-hit"
            : effect?.kind === "heal" ||
                effect?.kind === "mpRecover" ||
                effect?.kind === "money" ||
                effect?.kind === "draw"
              ? " is-effect-buffed"
              : "";
        return (
          <button
            className={`gf-target-pill${isActive ? " is-active-turn" : ""}${effectClass}`}
            key={p.id}
            onClick={() => onSelect(p.id)}
            disabled={!canSelect}
            style={{
              color: p.id === playerId ? "var(--bar-teal-dark)" : "#3f35d8",
            }}
            data-selected={selectedTargetId === p.id}
            data-player-id={p.id}
            data-effect={effect?.kind}
            aria-current={isActive ? "true" : undefined}
          >
            <span className="gf-target-dot" />
            <span className="gf-target-name">{p.name}</span>
            {partyCard && (
              <span
                className="gf-target-party"
                aria-label={`所属: ${PARTY_LABELS[p.party!]}`}
                title={`所属: ${PARTY_LABELS[p.party!]}`}
              >
                <span className="gf-target-party-emoji">{partyCard.emoji}</span>
                <span className="gf-target-party-label">
                  {PARTY_LABELS[p.party!]}
                </span>
              </span>
            )}
            <span className="gf-target-stats">
              <b>HP</b> <AnimatedNumber value={p.hp} /> <b>MP</b>{" "}
              <AnimatedNumber value={p.mp} /> <b>￥</b>{" "}
              <AnimatedNumber value={p.money} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
