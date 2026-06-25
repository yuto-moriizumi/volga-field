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
  /** 攻撃力を追加するカード (trueなら他の攻撃カードや攻撃力追加カードと同時に使用可能) */
  isAttackPower?: boolean;
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

export interface PartyCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
  attribute: AttributeKey;
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
    | "party-list"
    | "phenomenon-list"
    | "trade-list";
  /** 画像グリッドで表示するカード群 */
  cards?:
    | WeaponCard[]
    | ArmorCard[]
    | ItemCard[]
    | MiracleCard[]
    | DevilCard[]
    | PartyCard[]
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
  ...attributeWeapons("socialist_strike", "socialism", "fire", [
    { name: "労働者の一撃", emoji: "🔨" },
    { name: "階級闘争", emoji: "✊" },
    { name: "国有化攻勢", emoji: "🏭" },
    { name: "革命の波", emoji: "🌊" },
    { name: "赤い総攻撃", emoji: "🚩" },
  ]),
  ...attributeWeapons("socialist_power", "socialism", "fire", [
    { name: "団結", emoji: "🤝" },
    { name: "計画経済", emoji: "📊" },
    { name: "労働動員", emoji: "👷" },
    { name: "革命熱", emoji: "🔥" },
    { name: "前衛党指導", emoji: "⭐" },
  ], { isAttackPower: true }),
  ...attributeWeapons("capitalist_strike", "capitalist", "water", [
    { name: "市場の一撃", emoji: "💵" },
    { name: "価格競争", emoji: "🏷️" },
    { name: "企業買収", emoji: "🏢" },
    { name: "投資攻勢", emoji: "💰" },
    { name: "独占支配", emoji: "👑" },
  ]),
  ...attributeWeapons("capitalist_power", "capitalist", "water", [
    { name: "利益追求", emoji: "📈" },
    { name: "資本注入", emoji: "💸" },
    { name: "株価高騰", emoji: "📊" },
    { name: "大量生産", emoji: "🏭" },
    { name: "市場独占", emoji: "🔒" },
  ], { isAttackPower: true }),
  ...attributeWeapons("republican_strike", "republican", "wood", [
    { name: "市民の一撃", emoji: "👤" },
    { name: "議会追及", emoji: "🏛️" },
    { name: "世論攻勢", emoji: "📢" },
    { name: "共和の剣", emoji: "⚔️" },
    { name: "民意の鉄槌", emoji: "🔨" },
  ]),
  ...attributeWeapons("republican_power", "republican", "wood", [
    { name: "市民支持", emoji: "👍" },
    { name: "議会承認", emoji: "✅" },
    { name: "憲法精神", emoji: "📜" },
    { name: "連帯演説", emoji: "🎤" },
    { name: "国民主権", emoji: "🗽" },
  ], { isAttackPower: true }),
  ...attributeWeapons("feudal_strike", "feudal", "earth", [
    { name: "従士の一撃", emoji: "🛡️" },
    { name: "年貢徴収", emoji: "💴" },
    { name: "騎士突撃", emoji: "🐎" },
    { name: "領主命令", emoji: "👑" },
    { name: "王権制圧", emoji: "🏰" },
  ]),
  ...attributeWeapons("feudal_power", "feudal", "earth", [
    { name: "忠誠", emoji: "💯" },
    { name: "家臣団", emoji: "👥" },
    { name: "城塞支援", emoji: "🏰" },
    { name: "血統の威光", emoji: "👑" },
    { name: "王命絶対", emoji: "🫅" },
  ], { isAttackPower: true }),
  ...attributeWeapons("environmentalist_strike", "environmentalist", "light", [
    { name: "蔦の一撃", emoji: "🌱" },
    { name: "抗議活動", emoji: "✊" },
    { name: "自然の反撃", emoji: "🐻" },
    { name: "緑の包囲網", emoji: "🌿" },
    { name: "大地の怒り", emoji: "🌍" },
  ]),
  ...attributeWeapons("environmentalist_power", "environmentalist", "light", [
    { name: "再生力", emoji: "💚" },
    { name: "森林保護", emoji: "🌳" },
    { name: "エコ連携", emoji: "♻️" },
    { name: "自然共鳴", emoji: "🌸" },
    { name: "地球の加護", emoji: "☀️" },
  ], { isAttackPower: true }),
  ...attributeWeapons("anarchist_strike", "anarchist", "dark", [
    { name: "投石", emoji: "🪨" },
    { name: "直接行動", emoji: "👊" },
    { name: "バリケード突破", emoji: "🚧" },
    { name: "権威破壊", emoji: "💥" },
    { name: "完全蜂起", emoji: "🔥" },
  ]),
  ...attributeWeapons("anarchist_power", "anarchist", "dark", [
    { name: "自律行動", emoji: "🌀" },
    { name: "分散戦術", emoji: "⚡" },
    { name: "反権威精神", emoji: "✊" },
    { name: "自由連帯", emoji: "🤝" },
    { name: "秩序崩壊", emoji: "💣" },
  ], { isAttackPower: true }),
];

function attributeWeapons(
  idPrefix: string,
  _tag: string,
  attribute: AttributeKey,
  cards: { name: string; emoji: string }[],
  options: { isAttackPower?: boolean } = {},
): WeaponCard[] {
  return cards.map((card, idx) => {
    const level = idx + 1;
    return {
      id: `${idPrefix}_${level}`,
      name: card.name,
      emoji: card.emoji,
      attack: level,
      price: level,
      rate: level <= 2 ? "3/500" : level <= 4 ? "4/500" : "2/500",
      attribute,
      isAttackPower: options.isAttackPower,
      note: options.isAttackPower ? "他の攻撃カードや攻撃力追加カードと同時に使える" : undefined,
    };
  });
}

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
  { id: "local_campaign", name: "地方遊説", emoji: "🎤", price: 3, description: "MP+1" },
  { id: "supporter_rally", name: "支持者集会", emoji: "📣", price: 5, description: "MP+2" },
  { id: "national_campaign", name: "全国遊説", emoji: "🗣️", price: 7, description: "MP+3" },
  { id: "un_speech", name: "国連総会演説", emoji: "🌐", price: 10, description: "MP+5" },
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

export const PARTIES: PartyCard[] = [
  {
    id: "communist_party",
    name: "共産党",
    emoji: "🚩",
    description: "使用すると社会主義の政党に所属する",
    attribute: "fire",
  },
  {
    id: "ldp",
    name: "自民党",
    emoji: "🏛️",
    description: "使用すると資本主義の政党に所属する",
    attribute: "water",
  },
  {
    id: "democratic_party",
    name: "民主党",
    emoji: "🗳️",
    description: "使用すると共和主義の政党に所属する",
    attribute: "wood",
  },
  {
    id: "constitutional_imperial_party",
    name: "立憲帝政党",
    emoji: "👑",
    description: "使用すると封建主義の政党に所属する",
    attribute: "earth",
  },
  {
    id: "green_party",
    name: "緑の党",
    emoji: "🌿",
    description: "使用すると環境主義の政党に所属する",
    attribute: "light",
  },
  {
    id: "anarchist_party",
    name: "無政府党",
    emoji: "🪬",
    description: "使用すると無政府主義の政党に所属する",
    attribute: "dark",
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
    id: "seitou",
    title: "政党",
    variant: "party-list",
    cards: PARTIES,
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
