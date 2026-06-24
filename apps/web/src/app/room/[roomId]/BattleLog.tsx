"use client";

import type { BattleLogEntry } from "@volga/shared";

const KIND_ICON: Record<BattleLogEntry["kind"], string> = {
  attack: "⚔",
  heal: "♥",
  equip: "🛡",
  magic: "✦",
  system: "i",
  special: "✪",
};

export function BattleLog({ entries }: { entries: BattleLogEntry[] }) {
  const last = entries.slice(-30);
  return (
    <section
      className="gf-card"
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxHeight: 180,
        overflowY: "auto",
      }}
    >
      <div className="gf-section-title">戦記</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {last.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-dark-soft)" }}>
            まだ何も起きていない…
          </div>
        )}
        {last.map((e, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "4px 8px",
              background: i % 2 ? "rgba(255,255,255,0.4)" : "transparent",
              borderRadius: 6,
            }}
          >
            <span style={{ opacity: 0.6, fontWeight: 900 }}>T{e.turn}</span>
            <span style={{ width: 16, textAlign: "center" }}>
              {KIND_ICON[e.kind]}
            </span>
            <span style={{ flex: 1 }}>{e.message}</span>
            {e.damage !== undefined && (
              <span
                style={{
                  color: "#b03030",
                  fontWeight: 900,
                  background: "#ffe2d6",
                  padding: "1px 8px",
                  borderRadius: 999,
                }}
              >
                -{e.damage}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
