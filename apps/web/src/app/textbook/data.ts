import {
  BASE_CARDS,
  DECK_SIZE,
  DOOMSDAY_DEVIL_RATE,
  DOOMSDAY_DEVILS,
  HAND_SIZE,
  INITIAL_HP,
  INITIAL_MONEY,
  INITIAL_MP,
  PARTY_ACTION_CHANCE,
  PARTY_ACTIONS,
  PARTY_IDEOLOGIES,
  getPartyId,
} from "@volga/game-core";
import type {
  CardDefinition,
  CardEffect,
  DoomsdayDevil,
  PartyAction,
} from "@volga/game-core";
import type { CardCategory, PartyId } from "@volga/shared";

/**
 * 教典のカード情報は packages/game-core の実装データから生成する。
 * このファイルには表示用の型・派生処理・静的なルール文だけを置き、
 * カードそのものの定義は持たない。
 */

export interface CatalogCard {
  id: string;
  name: string;
  emoji: string;
  category: CardCategory;
  description: string;
  /** 相手に与えるダメージ */
  damage: number;
  /** 攻撃力上昇 */
  attackPower: number;
  /** 表示用の攻撃値 (damage + attackPower) */
  attack: number;
  /** 自分に与えるダメージ */
  selfDamage: number;
  defense: number;
  heal: number;
  mpRecover: number;
  mpCost?: number;
  price?: number;
}

function sumEffects(
  card: CardDefinition,
  kind: CardEffect["kind"],
  target: CardEffect["target"],
): number {
  return card.effects
    .filter((effect) => effect.kind === kind && effect.target === target)
    .reduce((total, effect) => total + (effect.amount ?? 0), 0);
}

export function toCatalogCard(card: CardDefinition): CatalogCard {
  const damage = sumEffects(card, "damage", "opponent");
  const attackPower = sumEffects(card, "attack_power", "self");

  return {
    id: card.id,
    name: card.name,
    emoji: card.emoji,
    category: card.category,
    description: card.description,
    damage,
    attackPower,
    attack: damage + attackPower,
    selfDamage: sumEffects(card, "damage", "self"),
    defense: sumEffects(card, "defense", "self"),
    heal: sumEffects(card, "heal", "self"),
    mpRecover: sumEffects(card, "mpRecover", "self"),
    mpCost: card.mpCost,
    price: card.price,
  };
}

/** BASE_CARDS から生成した全カードの一覧。 */
export const CARD_CATALOG: CatalogCard[] = BASE_CARDS.map(toCatalogCard);

export function cardsByCategory(category: CardCategory): CatalogCard[] {
  return CARD_CATALOG.filter((card) => card.category === category);
}

/** カードの効果から表示用の数値ラベルを作る。 */
export function cardStatLabels(card: CatalogCard): string[] {
  const labels: string[] = [];
  if (card.damage > 0) {
    labels.push(
      card.category === "weapon" ? `攻${card.damage}` : `相手-${card.damage}`,
    );
  }
  if (card.attackPower > 0) labels.push(`攻+${card.attackPower}`);
  if (card.defense > 0) labels.push(`防${card.defense}`);
  if (card.heal > 0) labels.push(`HP+${card.heal}`);
  if (card.mpRecover > 0) labels.push(`MP+${card.mpRecover}`);
  if (card.selfDamage > 0) labels.push(`自分-${card.selfDamage}`);
  if (card.mpCost !== undefined) labels.push(`MP${card.mpCost}`);
  return labels;
}

export interface CatalogParty {
  id: PartyId;
  name: string;
  emoji: string;
  description: string;
  ideology: string;
  price?: number;
  actions: readonly PartyAction[];
}

export const PARTY_CATALOG: CatalogParty[] = BASE_CARDS.flatMap((card) => {
  const partyId = getPartyId(card.id);
  if (!partyId) return [];
  return [
    {
      id: partyId,
      name: card.name,
      emoji: card.emoji,
      description: card.description,
      ideology: PARTY_IDEOLOGIES[partyId],
      price: card.price,
      actions: PARTY_ACTIONS[partyId],
    },
  ];
});

export function partyActionText(action: PartyAction): string {
  switch (action.kind) {
    case "damage":
      return `相手-${action.amount}`;
    case "heal":
      return `HP+${action.amount}`;
    case "mp":
      return `MP+${action.amount}`;
    case "money":
      return `お金+${action.amount}`;
    case "steal":
      return `相手から${action.amount}円奪う`;
    default:
      return action.name;
  }
}

export interface CatalogDevil {
  id: string;
  name: string;
  emoji: string;
  action: string;
  effectLabel: string;
  weight: number;
  description: string;
}

function describeDevilEffect(effect: DoomsdayDevil["effect"]): string {
  switch (effect.kind) {
    case "damage":
      return `${effect.amount}ダメージ`;
    case "discard":
      return `神器を${effect.amount}枚捨てる`;
    case "heal":
      return `HP+${effect.amount}`;
    default:
      return "";
  }
}

export const DEVIL_CATALOG: CatalogDevil[] = DOOMSDAY_DEVILS.map((devil) => ({
  id: devil.id,
  name: devil.name,
  emoji: devil.emoji,
  action: devil.action,
  effectLabel: describeDevilEffect(devil.effect),
  weight: devil.weight,
  description: devil.description,
}));

export const DEVIL_WEIGHT_TOTAL = DOOMSDAY_DEVILS.reduce(
  (total, devil) => total + devil.weight,
  0,
);

export const DEVIL_RULE = `終末の時、手札を補充するために1枚引くたびに ${Math.round(
  DOOMSDAY_DEVIL_RATE * 100,
)}% の確率で悪魔が出現します。出現する悪魔は重み付き抽選で決まり、重みの合計は ${DEVIL_WEIGHT_TOTAL} です。悪魔は手番プレイヤーに効果を与えます。`;

export const PARTY_RULE = `他のプレイヤーのターン終了時、所属しているプレイヤーはそれぞれ ${Math.round(
  PARTY_ACTION_CHANCE * 100,
)}% で政党行動を起こします。行動は政党ごとの重み付き抽選で決まります。`;

export const DECK_NOTE = `デッキは全カードから${DECK_SIZE}枚を選んで構成します。カードごとの出現率は設定していません。`;

export interface RuleSection {
  title: string;
  lines: string[];
}

export const RULES: RuleSection[] = [
  {
    title: "基本",
    lines: [
      `HPは${INITIAL_HP}で開始。回復に上限はなく、${INITIAL_HP}を超えて増える。`,
      `MPは${INITIAL_MP}で開始。回復は最大MPまで。`,
      `所持金は${INITIAL_MONEY}で開始。取引カードで増減する。`,
      `手札は${HAND_SIZE}枚。山札から自動で補充する。`,
    ],
  },
  {
    title: "ターン",
    lines: [
      "1ターン中に複数のカードをプレイでき、好きなタイミングでターン終了を宣言する。",
      "攻撃カードと攻撃力追加カードは同時に使える。",
      "防御のときは防御カードを複数枚同時に使える。",
      "HPが0になったプレイヤーは敗北し、最後まで生存した1人が勝利する。",
    ],
  },
  {
    title: "終末の時",
    lines: [
      "修行モードでは終末の時を G.F.50 / G.F.75 / G.F.100 から選べる（なしも可）。",
      DEVIL_RULE,
    ],
  },
  {
    title: "政党",
    lines: [
      "政党カードを使うとその政党に所属する。所属は1つだけ。",
      PARTY_RULE,
      "攻撃・略奪の対象は、行動者から見た生存中の相手からランダムに選ばれる。",
      "所持金のある生存相手がいない場合、略奪は何も起こらない。",
    ],
  },
  {
    title: "カード",
    lines: [
      "カテゴリは 武器 / 防具 / 雑貨 / 奇跡 / 取引 / 政党。",
      "悪魔はカードではなく、終末の時に出現するイベント。",
      "雑貨は選挙運動の道具で、使うと MP を回復する。",
      DECK_NOTE,
    ],
  },
];

export type TextbookVariant =
  | "card-grid"
  | "card-list"
  | "party-list"
  | "devil-list"
  | "rules";

interface CategoryBase {
  id: string;
  title: string;
  note?: string;
}

export interface CardCategoryDefinition extends CategoryBase {
  variant: "card-grid" | "card-list";
  cards: CatalogCard[];
}

export interface PartyCategoryDefinition extends CategoryBase {
  variant: "party-list";
  parties: CatalogParty[];
}

export interface DevilCategoryDefinition extends CategoryBase {
  variant: "devil-list";
  devils: CatalogDevil[];
  rule: string;
}

export interface RulesCategoryDefinition extends CategoryBase {
  variant: "rules";
  sections: RuleSection[];
}

export type TextbookCategory =
  | CardCategoryDefinition
  | PartyCategoryDefinition
  | DevilCategoryDefinition
  | RulesCategoryDefinition;

/** 教典のタブ。実装済みのカテゴリだけを並べる。 */
export const CATEGORIES: TextbookCategory[] = [
  {
    id: "buki",
    title: "武器",
    variant: "card-grid",
    cards: cardsByCategory("weapon"),
    note: DECK_NOTE,
  },
  {
    id: "bugu",
    title: "防具",
    variant: "card-grid",
    cards: cardsByCategory("shield"),
    note: DECK_NOTE,
  },
  {
    id: "zakka",
    title: "雑貨",
    variant: "card-list",
    cards: cardsByCategory("misc"),
    note: `雑貨は選挙運動の道具で、使うと MP を回復します。${DECK_NOTE}`,
  },
  {
    id: "kiseki",
    title: "奇跡",
    variant: "card-list",
    cards: cardsByCategory("miracle"),
    note: DECK_NOTE,
  },
  {
    id: "torihiki",
    title: "取引",
    variant: "card-list",
    cards: cardsByCategory("trade"),
    note: "取引カードは手札から使って、相手や自分のカード・HP・MP・お金を動かします。",
  },
  {
    id: "seitou",
    title: "政党",
    variant: "party-list",
    parties: PARTY_CATALOG,
    note: PARTY_RULE,
  },
  {
    id: "akuma",
    title: "悪魔",
    variant: "devil-list",
    devils: DEVIL_CATALOG,
    rule: DEVIL_RULE,
  },
  {
    id: "rule",
    title: "ルール",
    variant: "rules",
    sections: RULES,
  },
];
