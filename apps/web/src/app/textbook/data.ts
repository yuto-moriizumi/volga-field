export type AttributeKey =
  | "none"
  | "fire"
  | "water"
  | "wood"
  | "earth"
  | "light"
  | "dark";

export interface AttributeInfo {
  key: AttributeKey;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const ATTRIBUTES: AttributeInfo[] = [
  { key: "none", label: "無属性", icon: "〇", color: "#9aa4a0", bgColor: "#e6ebe9" },
  { key: "fire", label: "社会主義", icon: "♨", color: "#d9473a", bgColor: "#fbe2dc" },
  { key: "water", label: "資本主義", icon: "〰", color: "#3a78d4", bgColor: "#dde9f8" },
  { key: "wood", label: "共和主義", icon: "✿", color: "#d68a3a", bgColor: "#f6e9d2" },
  { key: "earth", label: "封建主義", icon: "⛰", color: "#8a8074", bgColor: "#e8e3da" },
  { key: "light", label: "環境主義", icon: "☀", color: "#e5b431", bgColor: "#fbeec3" },
  { key: "dark", label: "無政府主義", icon: "☾", color: "#8b5cc4", bgColor: "#e6dcf3" },
];

export const ATTR_BY_KEY: Record<AttributeKey, AttributeInfo> =
  ATTRIBUTES.reduce(
    (acc, attr) => ({ ...acc, [attr.key]: attr }),
    {} as Record<AttributeKey, AttributeInfo>,
  );

export type Token =
  | { type: "text"; value: string }
  | { type: "attr"; key: AttributeKey };

export interface WeaponCard {
  id: string;
  name: string;
  emoji: string;
  attack: number;
  /** 価格 (￥) */
  price: number;
  /** 授かり率 */
  rate: string;
  attribute?: AttributeKey;
  note?: string;
}

export interface ArmorCard {
  id: string;
  name: string;
  emoji: string;
  defense: number;
  price?: number;
  attribute?: AttributeKey;
  note?: string;
}

export interface ItemCard {
  id: string;
  name: string;
  emoji: string;
  price?: number;
  description: string;
  attribute?: AttributeKey;
}

export interface MiracleCard {
  id: string;
  name: string;
  emoji: string;
  price?: number;
  description: string;
  attribute?: AttributeKey;
}

export interface DevilCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface GuardianCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface PhenomenonCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface CalamityCard {
  id: string;
  name: string;
  emoji: string;
  /** 表示色 */
  color: string;
  description: string;
  note?: string;
}

export interface AttributeEntry {
  tokens: Token[];
  note?: string;
}

export interface TextbookCategory {
  id: string;
  title: string;
  variant:
    | "text"
    | "weapon-grid"
    | "armor-grid"
    | "item-list"
    | "miracle-list"
    | "calamity-list"
    | "devil-list"
    | "guardian-list"
    | "phenomenon-list"
    | "trade-list";
  /** 画像グリッドで表示するカード群 */
  cards?:
    | WeaponCard[]
    | ArmorCard[]
    | ItemCard[]
    | MiracleCard[]
    | DevilCard[]
    | GuardianCard[]
    | PhenomenonCard[]
    | CalamityCard[];
  /** テキスト形式のエントリ */
  entries?: AttributeEntry[];
}

function T(value: string): Token {
  return { type: "text", value };
}
function A(key: AttributeKey): Token {
  return { type: "attr", key };
}

export const WEAPONS: WeaponCard[] = [
  { id: "club", name: "こん棒", emoji: "🪵", attack: 1, price: 1, rate: "3/500" },
  { id: "dagger", name: "短剣", emoji: "🗡️", attack: 2, price: 2, rate: "5/500" },
  { id: "sword", name: "剣", emoji: "⚔️", attack: 3, price: 3, rate: "6/500" },
  { id: "axe", name: "斧", emoji: "🪓", attack: 4, price: 4, rate: "5/500", note: "自分も-2" },
  { id: "spear", name: "槍", emoji: "🔱", attack: 2, price: 2, rate: "5/500" },
  { id: "bow", name: "弓", emoji: "🏹", attack: 2, price: 2, rate: "5/500" },
  {
    id: "great_sword",
    name: "大剣",
    emoji: "⚔️",
    attack: 5,
    price: 6,
    rate: "4/500",
    note: "自分も-1",
  },
  { id: "flame_sword", name: "炎の剣", emoji: "🔥", attack: 4, price: 5, rate: "3/500", attribute: "fire" },
  { id: "trident", name: "トライデント", emoji: "🔱", attack: 4, price: 5, rate: "3/500", attribute: "water" },
  { id: "thorn_whip", name: "茨の鞭", emoji: "🌿", attack: 3, price: 4, rate: "3/500", attribute: "wood" },
  { id: "rock_hammer", name: "岩の槌", emoji: "🪨", attack: 5, price: 5, rate: "3/500", attribute: "earth" },
  { id: "light_spear", name: "光の槍", emoji: "✨", attack: 4, price: 5, rate: "3/500", attribute: "light" },
  { id: "dark_blade", name: "闇の刃", emoji: "🌑", attack: 5, price: 6, rate: "3/500", attribute: "dark" },
  { id: "god_slayer", name: "神殺し", emoji: "💀", attack: 8, price: 10, rate: "1/500", note: "自分も-3" },
];

export const ARMORS: ArmorCard[] = [
  { id: "leaf_shield", name: "木の葉盾", emoji: "🍃", defense: 1, price: 1 },
  { id: "small_shield", name: "小盾", emoji: "🛡️", defense: 2, price: 2 },
  { id: "shield", name: "盾", emoji: "🛡️", defense: 3, price: 3 },
  { id: "great_shield", name: "大盾", emoji: "🛡️", defense: 6, price: 5, note: "攻撃時-3" },
  { id: "rock_shield", name: "岩の盾", emoji: "🪨", defense: 4, price: 4, attribute: "earth" },
  { id: "holy_shield", name: "聖なる盾", emoji: "✨", defense: 4, price: 4, attribute: "light" },
];

export const ITEMS: ItemCard[] = [
  { id: "herb", name: "薬草", emoji: "🌿", price: 1, description: "HP+3" },
  { id: "potion", name: "回復薬", emoji: "🧪", price: 3, description: "HP+5" },
  { id: "hi_potion", name: "高級回復薬", emoji: "🍷", price: 6, description: "HP+10" },
  { id: "antidote", name: "解毒草", emoji: "🍀", price: 2, description: "病気を取り除く" },
  { id: "bomb", name: "爆弾", emoji: "💣", price: 4, description: "相手-4" },
  { id: "poison", name: "毒薬", emoji: "☠️", price: 3, description: "相手-3" },
];

export const MIRACLES: MiracleCard[] = [
  { id: "heal", name: "ヒール", emoji: "✨", price: 5, description: "HP+8" },
  {
    id: "tenbin",
    name: "天罰",
    emoji: "⚡",
    price: 8,
    description: "相手-5",
    attribute: "light",
  },
  {
    id: "kokoro_no_omoi",
    name: "自己犠牲",
    emoji: "💀",
    price: 7,
    description: "相手-8 / 自分も-5",
  },
];

export const CALAMITIES: CalamityCard[] = [
  {
    id: "kaze",
    name: "風邪",
    emoji: "🤧",
    color: "#3a78d4",
    description: "毎ターン1ダメージ",
    note: "(悪化すると熱病)",
  },
  {
    id: "netsu",
    name: "熱病",
    emoji: "🔥",
    color: "#d9473a",
    description: "毎ターン2ダメージ",
    note: "(悪化すると地獄病)",
  },
  {
    id: "jigoku",
    name: "地獄病",
    emoji: "🌋",
    color: "#d9473a",
    description: "毎ターン5ダメージ",
    note: "(悪化すると天国病)",
  },
  {
    id: "tengoku",
    name: "天国病",
    emoji: "🌈",
    color: "#3a78d4",
    description: "毎ターン+HP5",
    note: "(悪化するとHP0になる)",
  },
  {
    id: "kiri",
    name: "霧",
    emoji: "🌫️",
    color: "#8b5cc4",
    description: "周りの状況がわからなくなる",
  },
  {
    id: "senkou",
    name: "閃光",
    emoji: "⚡",
    color: "#e5b431",
    description: "防御のときに神器を一つしか使えない",
  },
  {
    id: "yume",
    name: "夢",
    emoji: "💫",
    color: "#d68a3a",
    description: "授かった神器が50%の確率で別の神器に見える",
  },
  {
    id: "anun",
    name: "暗雲",
    emoji: "☁️",
    color: "#8b5cc4",
    description: "全体攻撃を受けると必ず命中する",
  },
];

export const DEVILS: DevilCard[] = [
  {
    id: "berial",
    name: "ベリアル",
    emoji: "😈",
    description: "HP半分と引き換えに、強力な神器を得る",
  },
  {
    id: "astaroth",
    name: "アスタロト",
    emoji: "👿",
    description: "神器を捧げて相手神器を1つ破壊",
  },
  {
    id: "leviathan",
    name: "リヴァイアサン",
    emoji: "🐉",
    description: "HP3と引き換えに、相手-8",
  },
];

export const GUARDIANS: GuardianCard[] = [
  {
    id: "michael",
    name: "ミカエル",
    emoji: "👼",
    description: "無政府主義の攻撃を無効化",
  },
  {
    id: "raphael",
    name: "ラファエル",
    emoji: "🕊️",
    description: "毎ターンHP+1",
  },
  {
    id: "uriel",
    name: "ウリエル",
    emoji: "🔥",
    description: "炎の加護：社会主義の攻撃を+2",
  },
];

export const PHENOMENA: PhenomenonCard[] = [
  {
    id: "eclipse",
    name: "日蝕",
    emoji: "🌒",
    description: "無政府主義の攻撃力2倍",
  },
  {
    id: "meteor",
    name: "流星群",
    emoji: "☄️",
    description: "全員-3",
  },
  {
    id: "rift",
    name: "次元断裂",
    emoji: "🌀",
    description: "神器が一時的に使用不能",
  },
];

export const CATEGORIES: TextbookCategory[] = [
  {
    id: "zokusei",
    title: "属性",
    variant: "text",
    entries: [
      { tokens: [T("無属性の攻撃は、どの属性でも防御できる。")] },
      {
        tokens: [
          A("fire"),
          T("の攻撃は、"),
          A("water"),
          T("で防御できる。"),
        ],
      },
      {
        tokens: [
          A("water"),
          T("の攻撃は、"),
          A("fire"),
          T("で防御できる。"),
        ],
      },
      {
        tokens: [
          A("wood"),
          T("の攻撃は、"),
          A("earth"),
          T("で防御できる。"),
        ],
      },
      {
        tokens: [
          A("earth"),
          T("の攻撃は、"),
          A("wood"),
          T("で防御できる。"),
        ],
      },
      {
        tokens: [A("light"), T("の攻撃は、どの属性でも防御できない。")],
      },
      {
        tokens: [
          A("dark"),
          T("の攻撃は、どの属性でも防御できる。"),
        ],
        note: "ただし、ダメージを受けるとHP0になる。",
      },
    ],
  },
  {
    id: "wazawai",
    title: "災い",
    variant: "calamity-list",
    cards: CALAMITIES,
  },
  {
    id: "torihiki",
    title: "取引",
    variant: "trade-list",
  },
  {
    id: "buki",
    title: "武器",
    variant: "weapon-grid",
    cards: WEAPONS,
  },
  {
    id: "bugu",
    title: "防具",
    variant: "armor-grid",
    cards: ARMORS,
  },
  {
    id: "zakka",
    title: "雑貨",
    variant: "item-list",
    cards: ITEMS,
  },
  {
    id: "kiseki",
    title: "奇跡",
    variant: "miracle-list",
    cards: MIRACLES,
  },
  {
    id: "akuma",
    title: "悪魔",
    variant: "devil-list",
    cards: DEVILS,
  },
  {
    id: "shugoshin",
    title: "守護神",
    variant: "guardian-list",
    cards: GUARDIANS,
  },
  {
    id: "choujougenshou",
    title: "超常現象",
    variant: "phenomenon-list",
    cards: PHENOMENA,
  },
  {
    id: "fukano",
    title: "負荷の連携",
    variant: "text",
    entries: [
      { tokens: [T("異なる属性の神器を一緒に使うと無属性になる。")] },
      {
        tokens: [
          A("light"),
          T("は、"),
          A("fire"),
          T("、"),
          A("water"),
          T("、"),
          A("wood"),
          T("、"),
          A("earth"),
          T("の代わりになれる。"),
        ],
      },
    ],
  },
];
