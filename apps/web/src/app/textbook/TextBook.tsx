"use client";

import { useMemo, useState } from "react";
import { BottomBar } from "../_components/BottomBar";
import { TopBar } from "../_components/TopBar";
import {
  ATTR_BY_KEY,
  CATEGORIES,
  type ArmorCard,
  type AttributeKey,
  type CalamityCard,
  type DevilCard,
  type GuardianCard,
  type ItemCard,
  type MiracleCard,
  type PhenomenonCard,
  type Token,
  type WeaponCard,
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
          <CategoryView category={active} />
        </section>
      </main>

      <BottomBar />
    </div>
  );
}

function CategoryView({
  category,
}: {
  category: (typeof CATEGORIES)[number];
}) {
  switch (category.variant) {
    case "weapon-grid":
      return <WeaponGridView cards={category.cards as WeaponCard[]} />;
    case "armor-grid":
      return <ArmorGridView cards={category.cards as ArmorCard[]} />;
    case "calamity-list":
      return <CalamityListView cards={category.cards as CalamityCard[]} />;
    case "item-list":
      return <ItemListView cards={category.cards as ItemCard[]} />;
    case "miracle-list":
      return <MiracleListView cards={category.cards as MiracleCard[]} />;
    case "devil-list":
      return <DevilListView cards={category.cards as DevilCard[]} />;
    case "guardian-list":
      return <GuardianListView cards={category.cards as GuardianCard[]} />;
    case "phenomenon-list":
      return <PhenomenonListView cards={category.cards as PhenomenonCard[]} />;
    case "trade-list":
      return <TradeListView />;
    case "text":
    default:
      return <TextEntriesView entries={category.entries ?? []} />;
  }
}

function WeaponGridView({ cards }: { cards: WeaponCard[] }) {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id ?? "");
  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? cards[0]!,
    [cards, selectedId],
  );
  if (!selected) return null;

  return (
    <div className="gf-textbook-weapon">
      <div className="gf-textbook-weapon-detail">
        <div className="gf-textbook-weapon-icon">
          <span>{selected.emoji}</span>
          {selected.attribute && (
            <span
              className="gf-textbook-attr-mark"
              style={{
                background: ATTR_BY_KEY[selected.attribute].bgColor,
                color: ATTR_BY_KEY[selected.attribute].color,
                borderColor: ATTR_BY_KEY[selected.attribute].color,
              }}
            >
              {ATTR_BY_KEY[selected.attribute].icon}
            </span>
          )}
        </div>
        <div className="gf-textbook-weapon-info">
          <div className="gf-textbook-weapon-name">{selected.name}</div>
          <div className="gf-textbook-weapon-stats">
            <span>{selected.isAttackPower ? `+${selected.attack}` : `攻${selected.attack}`}</span>
            {selected.note && (
              <span className="gf-textbook-weapon-note">{selected.note}</span>
            )}
          </div>
        </div>
        <div className="gf-textbook-weapon-price">￥{selected.price}</div>
      </div>
      <div className="gf-textbook-weapon-rate">授かり率: {selected.rate}</div>
      <div className="gf-textbook-weapon-grid">
        {cards.map((card) => (
          <WeaponTile
            key={card.id}
            card={card}
            active={card.id === selected.id}
            onClick={() => setSelectedId(card.id)}
          />
        ))}
      </div>
    </div>
  );
}

function WeaponTile({
  card,
  active,
  onClick,
}: {
  card: WeaponCard;
  active: boolean;
  onClick: () => void;
}) {
  const attr = card.attribute ? ATTR_BY_KEY[card.attribute] : null;
  return (
    <button
      className={`gf-textbook-tile${active ? " is-active" : ""}`}
      onClick={onClick}
      style={
        attr
          ? {
              background: attr.bgColor,
              borderColor: attr.color,
            }
          : undefined
      }
    >
      <span className="gf-textbook-tile-emoji">{card.emoji}</span>
    </button>
  );
}

function ArmorGridView({ cards }: { cards: ArmorCard[] }) {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id ?? "");
  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? cards[0]!,
    [cards, selectedId],
  );
  if (!selected) return null;

  return (
    <div className="gf-textbook-weapon">
      <div className="gf-textbook-weapon-detail">
        <div className="gf-textbook-weapon-icon">
          <span>{selected.emoji}</span>
          {selected.attribute && (
            <span
              className="gf-textbook-attr-mark"
              style={{
                background: ATTR_BY_KEY[selected.attribute].bgColor,
                color: ATTR_BY_KEY[selected.attribute].color,
                borderColor: ATTR_BY_KEY[selected.attribute].color,
              }}
            >
              {ATTR_BY_KEY[selected.attribute].icon}
            </span>
          )}
        </div>
        <div className="gf-textbook-weapon-info">
          <div className="gf-textbook-weapon-name">{selected.name}</div>
          <div className="gf-textbook-weapon-stats">
            <span>防{selected.defense}</span>
            {selected.note && (
              <span className="gf-textbook-weapon-note">{selected.note}</span>
            )}
          </div>
        </div>
        {selected.price !== undefined && (
          <div className="gf-textbook-weapon-price">￥{selected.price}</div>
        )}
      </div>
      <div className="gf-textbook-weapon-grid">
        {cards.map((card) => (
          <ArmorTile
            key={card.id}
            card={card}
            active={card.id === selected.id}
            onClick={() => setSelectedId(card.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ArmorTile({
  card,
  active,
  onClick,
}: {
  card: ArmorCard;
  active: boolean;
  onClick: () => void;
}) {
  const attr = card.attribute ? ATTR_BY_KEY[card.attribute] : null;
  return (
    <button
      className={`gf-textbook-tile${active ? " is-active" : ""}`}
      onClick={onClick}
      style={
        attr
          ? {
              background: attr.bgColor,
              borderColor: attr.color,
            }
          : undefined
      }
    >
      <span className="gf-textbook-tile-emoji">{card.emoji}</span>
    </button>
  );
}

function CalamityListView({ cards }: { cards: CalamityCard[] }) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => (
          <div key={card.id} className="gf-textbook-calamity-card">
            <div className="gf-textbook-calamity-icon">{card.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div
                className="gf-textbook-calamity-name"
                style={{ color: card.color }}
              >
                {card.name}
              </div>
              <div className="gf-textbook-calamity-desc">
                {card.description}
              </div>
              {card.note && (
                <div className="gf-textbook-calamity-note">{card.note}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="gf-textbook-calamity-footer">
        <p>病は毎ターン5%の確率で自然に悪化する。</p>
        <p>病に病を重ねると悪化する。</p>
        <p>霧の中から敵に神器を使う場合、使用先は霧の中から無作為に選ばれる。</p>
      </div>
    </div>
  );
}

function ItemListView({ cards }: { cards: ItemCard[] }) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => (
          <div key={card.id} className="gf-textbook-item-card">
            <div className="gf-textbook-calamity-icon">{card.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div className="gf-textbook-item-name">
                {card.name}
                {card.price !== undefined && (
                  <span className="gf-textbook-item-price">￥{card.price}</span>
                )}
              </div>
              <div className="gf-textbook-calamity-desc">{card.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiracleListView({ cards }: { cards: MiracleCard[] }) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => {
          const attr = card.attribute ? ATTR_BY_KEY[card.attribute] : null;
          return (
            <div
              key={card.id}
              className="gf-textbook-item-card"
              style={
                attr
                  ? {
                      background: attr.bgColor,
                      borderColor: attr.color,
                    }
                  : undefined
              }
            >
              <div className="gf-textbook-calamity-icon">{card.emoji}</div>
              <div className="gf-textbook-calamity-body">
                <div
                  className="gf-textbook-item-name"
                  style={attr ? { color: attr.color } : undefined}
                >
                  {card.name}
                  {card.price !== undefined && (
                    <span className="gf-textbook-item-price">￥{card.price}</span>
                  )}
                </div>
                <div className="gf-textbook-calamity-desc">{card.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DevilListView({ cards }: { cards: DevilCard[] }) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="gf-textbook-item-card"
            style={{ background: "#e6dcf3", borderColor: "#8b5cc4" }}
          >
            <div className="gf-textbook-calamity-icon">{card.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div
                className="gf-textbook-item-name"
                style={{ color: "#8b5cc4" }}
              >
                {card.name}
              </div>
              <div className="gf-textbook-calamity-desc">{card.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuardianListView({ cards }: { cards: GuardianCard[] }) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="gf-textbook-item-card"
            style={{ background: "#fbeec3", borderColor: "#e5b431" }}
          >
            <div className="gf-textbook-calamity-icon">{card.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div
                className="gf-textbook-item-name"
                style={{ color: "#a17a1f" }}
              >
                {card.name}
              </div>
              <div className="gf-textbook-calamity-desc">{card.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhenomenonListView({ cards }: { cards: PhenomenonCard[] }) {
  return (
    <div className="gf-textbook-calamity">
      <div className="gf-textbook-calamity-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="gf-textbook-item-card"
            style={{ background: "#dde9f8", borderColor: "#3a78d4" }}
          >
            <div className="gf-textbook-calamity-icon">{card.emoji}</div>
            <div className="gf-textbook-calamity-body">
              <div
                className="gf-textbook-item-name"
                style={{ color: "#3a78d4" }}
              >
                {card.name}
              </div>
              <div className="gf-textbook-calamity-desc">{card.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeListView() {
  const trades = [
    {
      name: "買う",
      emoji: "💰",
      description: "相手の手札から1枚選んで買う",
    },
    {
      name: "売る",
      emoji: "🏷️",
      description: "手札を選んで相手に売りつける",
    },
    {
      name: "両替",
      emoji: "🔄",
      description: "HPを削ってMPやお金に換える",
    },
  ];
  return (
    <div className="gf-textbook-trade">
      <h2 className="gf-textbook-title">取引</h2>
      <div className="gf-textbook-trade-list">
        {trades.map((t) => (
          <div key={t.name} className="gf-textbook-trade-item">
            <div className="gf-textbook-trade-title">
              {t.emoji} {t.name}
            </div>
            <div className="gf-textbook-trade-desc">{t.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextEntriesView({
  entries,
}: {
  entries: { tokens: Token[]; note?: string }[];
}) {
  return (
    <>
      <h2 className="gf-textbook-title">説明</h2>
      <div className="gf-textbook-entries">
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`gf-textbook-entry${entry.note ? " has-note" : ""}`}
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
    </>
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