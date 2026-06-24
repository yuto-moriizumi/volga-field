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
}

export const ATTRIBUTES: AttributeInfo[] = [
  { key: "none", label: "無属性", icon: "◯", color: "#9aa4a0" },
  { key: "fire", label: "火属性", icon: "♨", color: "#d9473a" },
  { key: "water", label: "水属性", icon: "〰", color: "#3a78d4" },
  { key: "wood", label: "木属性", icon: "✿", color: "#d68a3a" },
  { key: "earth", label: "土属性", icon: "⛰", color: "#8a8074" },
  { key: "light", label: "光属性", icon: "☀", color: "#e5b431" },
  { key: "dark", label: "闇属性", icon: "☾", color: "#8b5cc4" },
];

export const ATTR_BY_KEY: Record<AttributeKey, AttributeInfo> =
  ATTRIBUTES.reduce(
    (acc, attr) => ({ ...acc, [attr.key]: attr }),
    {} as Record<AttributeKey, AttributeInfo>,
  );

export type Token =
  | { type: "text"; value: string }
  | { type: "attr"; key: AttributeKey };

export interface TextbookEntry {
  tokens: Token[];
  /** 補足行 (インデント表示) */
  note?: string;
}

export interface TextbookCategory {
  id: string;
  title: string;
  entries: TextbookEntry[];
}

function T(value: string): Token {
  return { type: "text", value };
}
function A(key: AttributeKey): Token {
  return { type: "attr", key };
}

export const CATEGORIES: TextbookCategory[] = [
  {
    id: "zokusei",
    title: "属性",
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
        tokens: [A("dark"), T("の攻撃は、どの属性でも防御できる。")],
        note: "ただし、ダメージを受けるとHP0になる。",
      },
    ],
  },
  {
    id: "wazawai",
    title: "災い",
    entries: [
      { tokens: [T("戦況が悪化すると「災い」が発生する。")] },
      { tokens: [T("災いは全プレイヤーに等しく降りかかる。")] },
      { tokens: [A("fire"), T("の災い「灼熱」")] },
      { tokens: [A("water"), T("の災い「洪水」")] },
      { tokens: [A("wood"), T("の災い「瘴気」")] },
    ],
  },
  {
    id: "torihiki",
    title: "取引",
    entries: [
      { tokens: [T("神は時に、預言者に取引を持ちかける。")] },
      {
        tokens: [
          T("HPや神器と引き換えに、強力な加護を得ることができる。"),
        ],
      },
      { tokens: [T("取引はターン消費を伴わない。")] },
    ],
  },
  {
    id: "buki",
    title: "武器",
    entries: [
      { tokens: [T("武器は攻撃力に直結する。")] },
      { tokens: [A("fire"), T("の武器「フレイムソード」")] },
      { tokens: [A("water"), T("の武器「トライデント」")] },
      { tokens: [A("wood"), T("の武器「茨の鞭」")] },
    ],
  },
  {
    id: "bugu",
    title: "防具",
    entries: [
      { tokens: [T("防具は盾として装備すると、対応属性の攻撃を防ぐ。")] },
      { tokens: [A("earth"), T("の防具「岩の盾」")] },
      { tokens: [A("light"), T("の防具「聖なる盾」")] },
    ],
  },
  {
    id: "zakka",
    title: "雑貨",
    entries: [
      { tokens: [T("雑貨は消費して効果を発揮する補助アイテム。")] },
      { tokens: [T("「薬草」「解毒草」「爆弾」などがある。")] },
    ],
  },
  {
    id: "kiseki",
    title: "奇跡",
    entries: [
      { tokens: [T("神が預言者に下す奇跡は、状況を大きく覆す。")] },
      { tokens: [A("light"), T("の奇跡「天罰」")] },
      { tokens: [A("dark"), T("の奇跡「冥府の門」")] },
    ],
  },
  {
    id: "akuma",
    title: "悪魔",
    entries: [
      {
        tokens: [
          T(
            "悪魔との契約は、短期間の圧倒的恩恵と引き換えに魂を要求する。",
          ),
        ],
      },
      { tokens: [A("dark"), T("の悪魔「ベリアル」")] },
    ],
  },
  {
    id: "shugoshin",
    title: "守護神",
    entries: [
      { tokens: [T("守護神は預言者に常時加護を与える。")] },
      { tokens: [A("light"), T("の守護神「ミカエル」")] },
    ],
  },
  {
    id: "choujougenshou",
    title: "超常現象",
    entries: [
      { tokens: [T("神々の気まぐれで世界法則が捻じ曲げられることがある。")] },
      {
        tokens: [
          T("「日蝕」「流星群」「次元断裂」など、稀に発生する。"),
        ],
      },
    ],
  },
  {
    id: "fukano",
    title: "負荷の連携",
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