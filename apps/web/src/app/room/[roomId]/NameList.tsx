"use client";

import type { PlayerState } from "@volga/shared";

interface NameListProps {
  players: PlayerState[];
  playerId: string | null;
  selectedTargetId: string | null;
  canSelect: boolean;
  onSelect: (playerId: string) => void;
}

export function NameList({
  players,
  playerId,
  selectedTargetId,
  canSelect,
  onSelect,
}: NameListProps) {
  return (
    <div className="gf-name-list" aria-label="プレイヤー一覧">
      {players.map((p) => (
        <button
          className="gf-target-pill"
          key={p.id}
          onClick={() => onSelect(p.id)}
          disabled={!canSelect}
          style={{
            color: p.id === playerId ? "var(--bar-teal-dark)" : "#3f35d8",
          }}
          data-selected={selectedTargetId === p.id}
        >
          <span className="gf-target-dot" />
          <span className="gf-target-name">{p.name}</span>
          <span className="gf-target-stats">
            <b>HP</b> {p.hp} <b>MP</b> {p.mp} <b>￥</b> 20
          </span>
        </button>
      ))}
    </div>
  );
}
