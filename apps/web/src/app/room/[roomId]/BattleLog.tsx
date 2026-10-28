"use client";

import { useEffect, useRef } from "react";
import type { BattleLogEntry } from "@volga/shared";

const KIND_ICON: Record<BattleLogEntry["kind"], string> = {
  attack: "⚔",
  heal: "♥",
  defense: "🛡",
  miracle: "✦",
  system: "i",
  special: "✪",
  trade: "￥",
  mpRecover: "✧",
};

/** Distance from the bottom (px) that still counts as "following the log". */
const STICK_THRESHOLD = 24;

export function BattleLog({ entries }: { entries: BattleLogEntry[] }) {
  const last = entries.slice(-30);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // The log keeps a fixed height, so new entries scroll inside it instead of
  // moving the hand. Follow the newest entry unless the player scrolled up.
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="gf-card gf-info-log">
      <div className="gf-info-log-inner">
        <div className="gf-section-title">戦記</div>
        <div
          className="gf-info-log-list"
          ref={listRef}
          onScroll={() => {
            const list = listRef.current;
            if (!list) return;
            stickToBottom.current =
              list.scrollHeight - list.scrollTop - list.clientHeight < STICK_THRESHOLD;
          }}
        >
          {last.length === 0 && (
            <div className="gf-info-log-empty">まだ何も起きていない…</div>
          )}
          {last.map((e, i) => (
            <div key={i} className="gf-info-log-entry">
              <span className="gf-info-log-turn">T{e.turn}</span>
              <span className="gf-info-log-icon">{KIND_ICON[e.kind]}</span>
              <span className="gf-info-log-message">{e.message}</span>
              {e.damage !== undefined && (
                <span className="gf-info-log-damage">-{e.damage}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
