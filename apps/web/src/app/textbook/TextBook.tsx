"use client";

import { useState } from "react";
import { BottomBar } from "../_components/BottomBar";
import { TopBar } from "../_components/TopBar";
import {
  ATTR_BY_KEY,
  CATEGORIES,
  type AttributeKey,
  type Token,
} from "./data";

export function TextBook() {
  const [activeId, setActiveId] = useState<string>(CATEGORIES[0]!.id);
  const active =
    CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0]!;

  return (
    <div className="gf-app">
      <TopBar title="教典" hideTextbook />

      <main
        className="gf-textbook-main"
        style={{
          background:
            "linear-gradient(180deg, var(--panel-mint), var(--panel-light-teal))",
        }}
      >
        <aside className="gf-textbook-side">
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === activeId;
            return (
              <button
                key={cat.id}
                className={`gf-textbook-cat${isActive ? " is-active" : ""}`}
                onClick={() => setActiveId(cat.id)}
              >
                {cat.title}
              </button>
            );
          })}
        </aside>

        <section className="gf-textbook-body">
          <h2 className="gf-textbook-title">{active.title}</h2>
          <div className="gf-textbook-entries">
            {active.entries.map((entry, i) => (
              <div
                key={i}
                className={`gf-textbook-entry${
                  entry.note ? " has-note" : ""
                }`}
              >
                <div className="gf-textbook-row">
                  {entry.tokens.map((tok, j) => (
                    <TokenView key={j} tok={tok} />
                  ))}
                </div>
                {entry.note && (
                  <div className="gf-textbook-note">{entry.note}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomBar />
    </div>
  );
}

function TokenView({ tok }: { tok: Token }) {
  if (tok.type === "text") {
    return <span className="gf-textbook-text">{tok.value}</span>;
  }
  const attr = ATTR_BY_KEY[tok.key as AttributeKey];
  return (
    <span
      className="gf-textbook-attr"
      style={{ color: attr.color }}
      title={attr.label}
    >
      <span className="gf-textbook-attr-icon" style={{ borderColor: attr.color }}>
        {attr.icon}
      </span>
      <span className="gf-textbook-attr-label">{attr.label}</span>
    </span>
  );
}