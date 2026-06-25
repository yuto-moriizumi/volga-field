"use client";

import type { CardRef } from "@volga/shared";
import { BattleLog } from "./BattleLog";
import { LargeCard } from "./LargeCard";

interface InfoAreaProps {
  hoveredCard: CardRef | null;
  entries: import("@volga/shared").BattleLogEntry[];
}

export function InfoArea({ hoveredCard, entries }: InfoAreaProps) {
  return (
    <section className="gf-info-area" aria-label="情報エリア">
      <div className="gf-info-card">
        {hoveredCard ? (
          <LargeCard cardRef={hoveredCard} />
        ) : (
          <div className="gf-info-card-empty">カード情報を表示</div>
        )}
      </div>
      <BattleLog entries={entries} />
    </section>
  );
}
