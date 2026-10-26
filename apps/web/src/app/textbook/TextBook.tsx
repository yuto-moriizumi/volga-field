"use client";

import { useMemo, useState } from "react";
import { BottomBar } from "../_components/BottomBar";
import { TopBar } from "../_components/TopBar";
import {
  CATEGORIES,
  cardStatLabels,
  partyActionText,
  type CatalogCard,
  type CatalogDevil,
  type CatalogParty,
  type RuleSection,
  type TextbookCategory,
} from "./data";

export function TextBook() {
  const [activeId, setActiveId] = useState<string>(CATEGORIES[0]!.id);
  const active =
    CATEGORIES.find((category) => category.id === activeId) ?? CATEGORIES[0]!;

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
          {CATEGORIES.map((category) => {
            const isActive = category.id === activeId;
            return (
              <button
                key={category.id}
                className={`gf-textbook-cat${isActive ? " is-active" : ""}`}
                onClick={() => setActiveId(category.id)}
              >
                {category.title}
              </button>
            );
          })}
        </aside>

        <section className="gf-textbook-body">
          <div
            role="note"
            style={{
              background: "var(--panel-cream)",
              border: "1.5px solid var(--bar-teal)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text-dark)",
            }}
          >
            カード一覧は <code>packages/game-core</code>{" "}
            の実装データから自動生成しています。
          </div>
          <CategoryView category={active} />
        </section>
      </main>

      <BottomBar />
    </div>
  );
}

function CategoryView({ category }: { category: TextbookCategory }) {
  switch (category.variant) {
    case "card-grid":
      return (
        <CardGridCatalog
          key={category.id}
          cards={category.cards}
          note={category.note}
        />
      );
    case "card-list":
      return (
        <CardListCatalog
          key={category.id}
          cards={category.cards}
          note={category.note}
        />
      );
    case "party-list":
      return (
        <PartyListView
          key={category.id}
          parties={category.parties}
          note={category.note}
        />
      );
    case "devil-list":
      return (
        <DevilListView
          key={category.id}
          devils={category.devils}
          rule={category.rule}
          note={category.note}
        />
      );
    case "rules":
      return (
        <RulesView
          key={category.id}
          title={category.title}
          sections={category.sections}
        />
      );
    default:
      return null;
  }
}

function CardGridCatalog({
  cards,
  note,
}: {
  cards: CatalogCard[];
  note?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id ?? "");
  const selected = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? cards[0],
    [cards, selectedId],
  );
  if (!selected) return null;

  const stats = cardStatLabels(selected);

  return (
    <div className="gf-textbook-weapon">
      <div className="gf-textbook-weapon-detail">
        <div className="gf-textbook-weapon-icon">
          <span>{selected.emoji}</span>
        </div>
        <div className="gf-textbook-weapon-info">
          <div className="gf-textbook-weapon-name">{selected.name}</div>
          <div className="gf-textbook-weapon-stats">
            {stats.map((stat) => (
              <span key={stat}>{stat}</span>
            ))}
          </div>
          <div className="gf-textbook-weapon-note">{selected.description}</div>
        </div>
        {selected.price !== undefined && (
          <div className="gf-textbook-weapon-price">￥{selected.price}</div>
        )}
      </div>
      <div className="gf-textbook-weapon-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            className={`gf-textbook-tile${
              card.id === selected.id ? " is-active" : ""
            }`}
            onClick={() => setSelectedId(card.id)}
            title={card.name}
            aria-label={card.name}
          >
            <span className="gf-textbook-tile-emoji">{card.emoji}</span>
          </button>
        ))}
      </div>
      {note && (
        <div className="gf-textbook-calamity-footer">
          <p>{note}</p>
        </div>
      )}
    </div>
  );
}

/** 説明文にすでに含まれる数値ラベルは重複表示しない。 */
function visibleStatLabels(card: CatalogCard): string[] {
  return cardStatLabels(card).filter(
    (stat) => !card.description.includes(stat),
  );
}

function CardListCatalog({
  cards,
  note,
}: {
  cards: CatalogCard[];
  note?: string;
}) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => {
          const stats = visibleStatLabels(card);
          return (
            <div key={card.id} className="gf-textbook-item-card">
              <div className="gf-textbook-calamity-icon">{card.emoji}</div>
              <div className="gf-textbook-calamity-body">
                <div className="gf-textbook-item-name">
                  <span>{card.name}</span>
                  {card.price !== undefined && (
                    <span className="gf-textbook-item-price">
                      ￥{card.price}
                    </span>
                  )}
                </div>
                <div className="gf-textbook-calamity-desc">
                  {card.description}
                </div>
                {stats.length > 0 && (
                  <div className="gf-textbook-stats">
                    {stats.map((stat) => (
                      <span key={stat} className="gf-textbook-stat">
                        {stat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <div className="gf-textbook-calamity-footer">
          <p>{note}</p>
        </div>
      )}
    </div>
  );
}

function PartyListView({
  parties,
  note,
}: {
  parties: CatalogParty[];
  note?: string;
}) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {parties.map((party) => (
          <div
            key={party.id}
            className="gf-textbook-item-card"
            style={{ background: "#e2efe5", borderColor: "#6cae8a" }}
          >
            <div className="gf-textbook-calamity-icon">{party.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div className="gf-textbook-item-name">
                <span>{party.name}</span>
                {party.price !== undefined && (
                  <span className="gf-textbook-item-price">
                    ￥{party.price}
                  </span>
                )}
              </div>
              <div className="gf-textbook-party-ideology">
                {party.ideology}
              </div>
              <div className="gf-textbook-calamity-desc">
                {party.description}
              </div>
              <div className="gf-textbook-party-actions">
                {party.actions.map((action) => (
                  <div key={action.name} className="gf-textbook-party-action">
                    <span className="gf-textbook-party-action-name">
                      {action.name}
                    </span>
                    <span>{partyActionText(action)}</span>
                    <span className="gf-textbook-party-action-weight">
                      重み {action.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {note && (
        <div className="gf-textbook-calamity-footer">
          <p>{note}</p>
        </div>
      )}
    </div>
  );
}

function DevilListView({
  devils,
  rule,
  note,
}: {
  devils: CatalogDevil[];
  rule: string;
  note?: string;
}) {
  return (
    <div className="gf-textbook-calamity">
      <div
        className="gf-textbook-calamity-desc"
        style={{ marginBottom: 12, lineHeight: 1.7 }}
      >
        {rule}
      </div>
      <div className="gf-textbook-calamity-grid">
        {devils.map((devil) => (
          <div
            key={devil.id}
            className="gf-textbook-item-card"
            style={{ background: "#e6dcf3", borderColor: "#8b5cc4" }}
          >
            <div className="gf-textbook-calamity-icon">{devil.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div className="gf-textbook-item-name">
                <span>{devil.name}</span>
                <span className="gf-textbook-item-price">
                  重み {devil.weight}
                </span>
              </div>
              <div className="gf-textbook-devil-action">{devil.action}</div>
              <div className="gf-textbook-calamity-desc">
                {devil.effectLabel}
              </div>
              <div className="gf-textbook-calamity-desc">
                {devil.description}
              </div>
            </div>
          </div>
        ))}
      </div>
      {note && (
        <div className="gf-textbook-calamity-footer">
          <p>{note}</p>
        </div>
      )}
    </div>
  );
}

function RulesView({
  title,
  sections,
}: {
  title: string;
  sections: RuleSection[];
}) {
  return (
    <div className="gf-textbook-trade">
      <h2 className="gf-textbook-title">{title}</h2>
      {sections.map((section) => (
        <div key={section.title} className="gf-textbook-trade-item">
          <div className="gf-textbook-trade-title">{section.title}</div>
          <div className="gf-textbook-rule-lines">
            {section.lines.map((line, index) => (
              <div
                key={`${section.title}-${index}`}
                className="gf-textbook-trade-desc"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
