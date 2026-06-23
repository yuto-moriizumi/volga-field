"use client";

import type { BattleLogEntry } from "@volga/shared";

const KIND_ICON: Record<BattleLogEntry["kind"], string> = {
  attack: "⚔️",
  heal: "💚",
  equip: "🛡️",
  magic: "✨",
  system: "ℹ️",
  special: "🃏",
};

export function BattleLog({ entries }: { entries: BattleLogEntry[] }) {
  const last = entries.slice(-20);
  return (
    <section
      style={{
        background: "var(--panel)",
        padding: 12,
        borderRadius: 8,
        maxHeight: 160,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          marginBottom: 8,
        }}
      >
        バトルログ
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {last.map((e, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ opacity: 0.6 }}>T{e.turn}</span>
            <span>{KIND_ICON[e.kind]}</span>
            <span>{e.message}</span>
            {e.damage !== undefined && (
              <span style={{ color: "var(--danger)", fontWeight: 700 }}>
                -{e.damage}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}