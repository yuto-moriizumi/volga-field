import type { CardCategory, PartyId } from "@volga/shared";

export type Target = "self" | "opponent" | "either";

export interface CardEffect {
  kind: "damage" | "heal" | "defense" | "mpRecover" | "attack_power";
  amount?: number;
  target: Target;
  description: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  category: CardCategory;
  emoji: string;
  description: string;
  effects: CardEffect[];
  mpCost?: number;
  price?: number;
  customTags?: string[];
}

export const BASE_CARDS: CardDefinition[] = [
  {
    id: "sword",
    name: "剣",
    category: "weapon",
    emoji: "⚔️",
    description: "相手-3",
    price: 4,
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "great_sword",
    name: "大剣",
    category: "weapon",
    emoji: "🗡️",
    description: "相手-5 / 自分も-1",
    price: 6,
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
      {
        kind: "damage",
        amount: 1,
        target: "self",
        description: "自分も-1",
      },
    ],
  },
  {
    id: "axe",
    name: "斧",
    category: "weapon",
    emoji: "🪓",
    description: "相手-4 / 自分も-2",
    price: 5,
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
      {
        kind: "damage",
        amount: 2,
        target: "self",
        description: "自分も-2",
      },
    ],
  },
  {
    id: "spear",
    name: "槍",
    category: "weapon",
    emoji: "🔱",
    description: "相手-2",
    price: 3,
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "bow",
    name: "弓",
    category: "weapon",
    emoji: "🏹",
    description: "相手-2",
    price: 3,
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "socialist_strike_1",
    name: "労働者の一撃",
    category: "weapon",
    emoji: "🔨",
    description: "相手-1",
    price: 1,
    customTags: ["socialism"],
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "socialist_strike_2",
    name: "階級闘争",
    category: "weapon",
    emoji: "✊",
    description: "相手-2",
    price: 2,
    customTags: ["socialism"],
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "socialist_strike_3",
    name: "国有化攻勢",
    category: "weapon",
    emoji: "🏭",
    description: "相手-3",
    price: 3,
    customTags: ["socialism"],
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "socialist_strike_4",
    name: "革命の波",
    category: "weapon",
    emoji: "🌊",
    description: "相手-4",
    price: 4,
    customTags: ["socialism"],
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "socialist_strike_5",
    name: "赤い総攻撃",
    category: "weapon",
    emoji: "🚩",
    description: "相手-5",
    price: 5,
    customTags: ["socialism"],
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "socialist_power_1",
    name: "団結",
    category: "weapon",
    emoji: "🤝",
    description: "攻撃力+1",
    price: 1,
    customTags: ["socialism"],
    effects: [
      {
        kind: "attack_power",
        amount: 1,
        target: "self",
        description: "攻撃力+1",
      },
    ],
  },
  {
    id: "socialist_power_2",
    name: "計画経済",
    category: "weapon",
    emoji: "📊",
    description: "攻撃力+2",
    price: 2,
    customTags: ["socialism"],
    effects: [
      {
        kind: "attack_power",
        amount: 2,
        target: "self",
        description: "攻撃力+2",
      },
    ],
  },
  {
    id: "socialist_power_3",
    name: "労働動員",
    category: "weapon",
    emoji: "👷",
    description: "攻撃力+3",
    price: 3,
    customTags: ["socialism"],
    effects: [
      {
        kind: "attack_power",
        amount: 3,
        target: "self",
        description: "攻撃力+3",
      },
    ],
  },
  {
    id: "socialist_power_4",
    name: "革命熱",
    category: "weapon",
    emoji: "🔥",
    description: "攻撃力+4",
    price: 4,
    customTags: ["socialism"],
    effects: [
      {
        kind: "attack_power",
        amount: 4,
        target: "self",
        description: "攻撃力+4",
      },
    ],
  },
  {
    id: "socialist_power_5",
    name: "前衛党指導",
    category: "weapon",
    emoji: "⭐",
    description: "攻撃力+5",
    price: 5,
    customTags: ["socialism"],
    effects: [
      {
        kind: "attack_power",
        amount: 5,
        target: "self",
        description: "攻撃力+5",
      },
    ],
  },
  {
    id: "capitalist_strike_1",
    name: "市場の一撃",
    category: "weapon",
    emoji: "💵",
    description: "相手-1",
    price: 1,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "capitalist_strike_2",
    name: "価格競争",
    category: "weapon",
    emoji: "🏷️",
    description: "相手-2",
    price: 2,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "capitalist_strike_3",
    name: "企業買収",
    category: "weapon",
    emoji: "🏢",
    description: "相手-3",
    price: 3,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "capitalist_strike_4",
    name: "投資攻勢",
    category: "weapon",
    emoji: "💰",
    description: "相手-4",
    price: 4,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "capitalist_strike_5",
    name: "独占支配",
    category: "weapon",
    emoji: "👑",
    description: "相手-5",
    price: 5,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "capitalist_power_1",
    name: "利益追求",
    category: "weapon",
    emoji: "📈",
    description: "攻撃力+1",
    price: 1,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 1,
        target: "self",
        description: "攻撃力+1",
      },
    ],
  },
  {
    id: "capitalist_power_2",
    name: "資本注入",
    category: "weapon",
    emoji: "💸",
    description: "攻撃力+2",
    price: 2,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 2,
        target: "self",
        description: "攻撃力+2",
      },
    ],
  },
  {
    id: "capitalist_power_3",
    name: "株価高騰",
    category: "weapon",
    emoji: "📊",
    description: "攻撃力+3",
    price: 3,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 3,
        target: "self",
        description: "攻撃力+3",
      },
    ],
  },
  {
    id: "capitalist_power_4",
    name: "大量生産",
    category: "weapon",
    emoji: "🏭",
    description: "攻撃力+4",
    price: 4,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 4,
        target: "self",
        description: "攻撃力+4",
      },
    ],
  },
  {
    id: "capitalist_power_5",
    name: "市場独占",
    category: "weapon",
    emoji: "🔒",
    description: "攻撃力+5",
    price: 5,
    customTags: ["capitalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 5,
        target: "self",
        description: "攻撃力+5",
      },
    ],
  },
  {
    id: "republican_strike_1",
    name: "市民の一撃",
    category: "weapon",
    emoji: "👤",
    description: "相手-1",
    price: 1,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "republican_strike_2",
    name: "議会追及",
    category: "weapon",
    emoji: "🏛️",
    description: "相手-2",
    price: 2,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "republican_strike_3",
    name: "世論攻勢",
    category: "weapon",
    emoji: "📢",
    description: "相手-3",
    price: 3,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "republican_strike_4",
    name: "共和の剣",
    category: "weapon",
    emoji: "⚔️",
    description: "相手-4",
    price: 4,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "republican_strike_5",
    name: "民意の鉄槌",
    category: "weapon",
    emoji: "🔨",
    description: "相手-5",
    price: 5,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "republican_power_1",
    name: "市民支持",
    category: "weapon",
    emoji: "👍",
    description: "攻撃力+1",
    price: 1,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "attack_power",
        amount: 1,
        target: "self",
        description: "攻撃力+1",
      },
    ],
  },
  {
    id: "republican_power_2",
    name: "議会承認",
    category: "weapon",
    emoji: "✅",
    description: "攻撃力+2",
    price: 2,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "attack_power",
        amount: 2,
        target: "self",
        description: "攻撃力+2",
      },
    ],
  },
  {
    id: "republican_power_3",
    name: "憲法精神",
    category: "weapon",
    emoji: "📜",
    description: "攻撃力+3",
    price: 3,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "attack_power",
        amount: 3,
        target: "self",
        description: "攻撃力+3",
      },
    ],
  },
  {
    id: "republican_power_4",
    name: "連帯演説",
    category: "weapon",
    emoji: "🎤",
    description: "攻撃力+4",
    price: 4,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "attack_power",
        amount: 4,
        target: "self",
        description: "攻撃力+4",
      },
    ],
  },
  {
    id: "republican_power_5",
    name: "国民主権",
    category: "weapon",
    emoji: "🗽",
    description: "攻撃力+5",
    price: 5,
    customTags: ["republicanism"],
    effects: [
      {
        kind: "attack_power",
        amount: 5,
        target: "self",
        description: "攻撃力+5",
      },
    ],
  },
  {
    id: "feudal_strike_1",
    name: "従士の一撃",
    category: "weapon",
    emoji: "🛡️",
    description: "相手-1",
    price: 1,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "feudal_strike_2",
    name: "年貢徴収",
    category: "weapon",
    emoji: "💴",
    description: "相手-2",
    price: 2,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "feudal_strike_3",
    name: "騎士突撃",
    category: "weapon",
    emoji: "🐎",
    description: "相手-3",
    price: 3,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "feudal_strike_4",
    name: "領主命令",
    category: "weapon",
    emoji: "👑",
    description: "相手-4",
    price: 4,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "feudal_strike_5",
    name: "王権制圧",
    category: "weapon",
    emoji: "🏰",
    description: "相手-5",
    price: 5,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "feudal_power_1",
    name: "忠誠",
    category: "weapon",
    emoji: "💯",
    description: "攻撃力+1",
    price: 1,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 1,
        target: "self",
        description: "攻撃力+1",
      },
    ],
  },
  {
    id: "feudal_power_2",
    name: "家臣団",
    category: "weapon",
    emoji: "👥",
    description: "攻撃力+2",
    price: 2,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 2,
        target: "self",
        description: "攻撃力+2",
      },
    ],
  },
  {
    id: "feudal_power_3",
    name: "城塞支援",
    category: "weapon",
    emoji: "🏰",
    description: "攻撃力+3",
    price: 3,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 3,
        target: "self",
        description: "攻撃力+3",
      },
    ],
  },
  {
    id: "feudal_power_4",
    name: "血統の威光",
    category: "weapon",
    emoji: "👑",
    description: "攻撃力+4",
    price: 4,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 4,
        target: "self",
        description: "攻撃力+4",
      },
    ],
  },
  {
    id: "feudal_power_5",
    name: "王命絶対",
    category: "weapon",
    emoji: "🫅",
    description: "攻撃力+5",
    price: 5,
    customTags: ["feudalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 5,
        target: "self",
        description: "攻撃力+5",
      },
    ],
  },
  {
    id: "environmentalist_strike_1",
    name: "蔦の一撃",
    category: "weapon",
    emoji: "🌱",
    description: "相手-1",
    price: 1,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "environmentalist_strike_2",
    name: "抗議活動",
    category: "weapon",
    emoji: "✊",
    description: "相手-2",
    price: 2,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "environmentalist_strike_3",
    name: "自然の反撃",
    category: "weapon",
    emoji: "🐻",
    description: "相手-3",
    price: 3,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "environmentalist_strike_4",
    name: "緑の包囲網",
    category: "weapon",
    emoji: "🌿",
    description: "相手-4",
    price: 4,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "environmentalist_strike_5",
    name: "大地の怒り",
    category: "weapon",
    emoji: "🌍",
    description: "相手-5",
    price: 5,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "environmentalist_power_1",
    name: "再生力",
    category: "weapon",
    emoji: "💚",
    description: "攻撃力+1",
    price: 1,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 1,
        target: "self",
        description: "攻撃力+1",
      },
    ],
  },
  {
    id: "environmentalist_power_2",
    name: "森林保護",
    category: "weapon",
    emoji: "🌳",
    description: "攻撃力+2",
    price: 2,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 2,
        target: "self",
        description: "攻撃力+2",
      },
    ],
  },
  {
    id: "environmentalist_power_3",
    name: "エコ連携",
    category: "weapon",
    emoji: "♻️",
    description: "攻撃力+3",
    price: 3,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 3,
        target: "self",
        description: "攻撃力+3",
      },
    ],
  },
  {
    id: "environmentalist_power_4",
    name: "自然共鳴",
    category: "weapon",
    emoji: "🌸",
    description: "攻撃力+4",
    price: 4,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 4,
        target: "self",
        description: "攻撃力+4",
      },
    ],
  },
  {
    id: "environmentalist_power_5",
    name: "地球の加護",
    category: "weapon",
    emoji: "☀️",
    description: "攻撃力+5",
    price: 5,
    customTags: ["environmentalism"],
    effects: [
      {
        kind: "attack_power",
        amount: 5,
        target: "self",
        description: "攻撃力+5",
      },
    ],
  },
  {
    id: "anarchist_strike_1",
    name: "投石",
    category: "weapon",
    emoji: "🪨",
    description: "相手-1",
    price: 1,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "anarchist_strike_2",
    name: "直接行動",
    category: "weapon",
    emoji: "👊",
    description: "相手-2",
    price: 2,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "anarchist_strike_3",
    name: "バリケード突破",
    category: "weapon",
    emoji: "🚧",
    description: "相手-3",
    price: 3,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "anarchist_strike_4",
    name: "権威破壊",
    category: "weapon",
    emoji: "💥",
    description: "相手-4",
    price: 4,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "anarchist_strike_5",
    name: "完全蜂起",
    category: "weapon",
    emoji: "🔥",
    description: "相手-5",
    price: 5,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "anarchist_power_1",
    name: "自律行動",
    category: "weapon",
    emoji: "🌀",
    description: "攻撃力+1",
    price: 1,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "attack_power",
        amount: 1,
        target: "self",
        description: "攻撃力+1",
      },
    ],
  },
  {
    id: "anarchist_power_2",
    name: "分散戦術",
    category: "weapon",
    emoji: "⚡",
    description: "攻撃力+2",
    price: 2,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "attack_power",
        amount: 2,
        target: "self",
        description: "攻撃力+2",
      },
    ],
  },
  {
    id: "anarchist_power_3",
    name: "反権威精神",
    category: "weapon",
    emoji: "✊",
    description: "攻撃力+3",
    price: 3,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "attack_power",
        amount: 3,
        target: "self",
        description: "攻撃力+3",
      },
    ],
  },
  {
    id: "anarchist_power_4",
    name: "自由連帯",
    category: "weapon",
    emoji: "🤝",
    description: "攻撃力+4",
    price: 4,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "attack_power",
        amount: 4,
        target: "self",
        description: "攻撃力+4",
      },
    ],
  },
  {
    id: "anarchist_power_5",
    name: "秩序崩壊",
    category: "weapon",
    emoji: "💣",
    description: "攻撃力+5",
    price: 5,
    customTags: ["anarchism"],
    effects: [
      {
        kind: "attack_power",
        amount: 5,
        target: "self",
        description: "攻撃力+5",
      },
    ],
  },
  {
    id: "shield",
    name: "盾",
    category: "shield",
    emoji: "🛡️",
    description: "防御力+3",
    price: 3,
    effects: [
      {
        kind: "defense",
        amount: 3,
        target: "self",
        description: "防御力+3",
      },
    ],
  },
  {
    id: "great_shield",
    name: "大盾",
    category: "shield",
    emoji: "🛡️",
    description: "防御力+6 (攻撃時-3)",
    price: 6,
    effects: [
      {
        kind: "defense",
        amount: 6,
        target: "self",
        description: "防御力+6",
      },
    ],
  },
  {
    id: "leaf_shield",
    name: "木の葉盾",
    category: "shield",
    emoji: "🍃",
    description: "防御力+1",
    price: 1,
    effects: [
      {
        kind: "defense",
        amount: 1,
        target: "self",
        description: "防御力+1",
      },
    ],
  },
  {
    id: "potion",
    name: "回復薬",
    category: "potion",
    emoji: "🧪",
    description: "HP+5",
    price: 4,
    effects: [
      {
        kind: "heal",
        amount: 5,
        target: "self",
        description: "HP+5",
      },
    ],
  },
  {
    id: "hi_potion",
    name: "高級回復薬",
    category: "potion",
    emoji: "🍷",
    description: "HP+10",
    price: 8,
    effects: [
      {
        kind: "heal",
        amount: 10,
        target: "self",
        description: "HP+10",
      },
    ],
  },
  {
    id: "poison",
    name: "毒薬",
    category: "potion",
    emoji: "☠️",
    description: "相手-3",
    price: 4,
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "fire",
    name: "ファイア",
    category: "miracle",
    emoji: "🔥",
    description: "MP2 / 相手-4",
    mpCost: 2,
    price: 5,
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "thunder",
    name: "サンダー",
    category: "miracle",
    emoji: "⚡",
    description: "MP4 / 相手-3 / 自分も-1",
    mpCost: 4,
    price: 6,
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
      {
        kind: "damage",
        amount: 1,
        target: "self",
        description: "自分も-1",
      },
    ],
  },
  {
    id: "heal",
    name: "ヒール",
    category: "miracle",
    emoji: "✨",
    description: "MP7 / HP+8",
    mpCost: 7,
    price: 10,
    effects: [
      {
        kind: "heal",
        amount: 8,
        target: "self",
        description: "HP+8",
      },
    ],
  },
  {
    id: "sacrifice",
    name: "自己犠牲",
    category: "special",
    emoji: "💀",
    description: "相手-8 / 自分も-5",
    price: 7,
    effects: [
      {
        kind: "damage",
        amount: 8,
        target: "opponent",
        description: "相手-8",
      },
      {
        kind: "damage",
        amount: 5,
        target: "self",
        description: "自分も-5",
      },
    ],
  },
  {
    id: "buy",
    name: "買う",
    category: "trade",
    emoji: "💰",
    description: "相手の手札から1枚選んで買う",
    effects: [],
  },
  {
    id: "sell",
    name: "売る",
    category: "trade",
    emoji: "🏷️",
    description: "手札を選んで相手に売りつける",
    effects: [],
  },
  {
    id: "exchange",
    name: "両替",
    category: "trade",
    emoji: "🔄",
    description: "HPをMPやお金に交換する",
    effects: [],
  },
  {
    id: "local_campaign",
    name: "地方遊説",
    category: "misc",
    emoji: "🎤",
    description: "MP+1",
    price: 3,
    effects: [
      {
        kind: "mpRecover",
        amount: 1,
        target: "self",
        description: "MP+1",
      },
    ],
  },
  {
    id: "supporter_rally",
    name: "支持者集会",
    category: "misc",
    emoji: "📣",
    description: "MP+2",
    price: 5,
    effects: [
      {
        kind: "mpRecover",
        amount: 2,
        target: "self",
        description: "MP+2",
      },
    ],
  },
  {
    id: "national_campaign",
    name: "全国遊説",
    category: "misc",
    emoji: "🗣️",
    description: "MP+3",
    price: 7,
    effects: [
      {
        kind: "mpRecover",
        amount: 3,
        target: "self",
        description: "MP+3",
      },
    ],
  },
  {
    id: "un_speech",
    name: "国連総会演説",
    category: "misc",
    emoji: "🌐",
    description: "MP+5",
    price: 10,
    effects: [
      {
        kind: "mpRecover",
        amount: 5,
        target: "self",
        description: "MP+5",
      },
    ],
  },
  {
    id: "concern_expressed",
    name: "懸念を表明する",
    category: "colorless",
    emoji: "🕊️",
    description: "相手-1",
    price: 1,
    effects: [
      {
        kind: "damage",
        amount: 1,
        target: "opponent",
        description: "相手-1",
      },
    ],
  },
  {
    id: "strong_concern",
    name: "強い懸念を表明する",
    category: "colorless",
    emoji: "📢",
    description: "相手-2",
    price: 2,
    effects: [
      {
        kind: "damage",
        amount: 2,
        target: "opponent",
        description: "相手-2",
      },
    ],
  },
  {
    id: "deeply_concerned",
    name: "憂慮している",
    category: "colorless",
    emoji: "😟",
    description: "相手-3",
    price: 3,
    effects: [
      {
        kind: "damage",
        amount: 3,
        target: "opponent",
        description: "相手-3",
      },
    ],
  },
  {
    id: "gravely_concerned",
    name: "深く憂慮している",
    category: "colorless",
    emoji: "😰",
    description: "相手-4",
    price: 4,
    effects: [
      {
        kind: "damage",
        amount: 4,
        target: "opponent",
        description: "相手-4",
      },
    ],
  },
  {
    id: "regrettable",
    name: "遺憾である",
    category: "colorless",
    emoji: "😔",
    description: "相手-5",
    price: 5,
    effects: [
      {
        kind: "damage",
        amount: 5,
        target: "opponent",
        description: "相手-5",
      },
    ],
  },
  {
    id: "extremely_regrettable",
    name: "極めて遺憾である",
    category: "colorless",
    emoji: "😠",
    description: "相手-6",
    price: 6,
    effects: [
      {
        kind: "damage",
        amount: 6,
        target: "opponent",
        description: "相手-6",
      },
    ],
  },
  {
    id: "strongly_protest",
    name: "強く抗議する",
    category: "colorless",
    emoji: "📣",
    description: "相手-7",
    price: 7,
    effects: [
      {
        kind: "damage",
        amount: 7,
        target: "opponent",
        description: "相手-7",
      },
    ],
  },
  {
    id: "sternly_protest",
    name: "厳重に抗議する",
    category: "colorless",
    emoji: "🚨",
    description: "相手-8",
    price: 8,
    effects: [
      {
        kind: "damage",
        amount: 8,
        target: "opponent",
        description: "相手-8",
      },
    ],
  },
  {
    id: "unacceptable",
    name: "断じて受け入れられない",
    category: "colorless",
    emoji: "⛔",
    description: "相手-9",
    price: 9,
    effects: [
      {
        kind: "damage",
        amount: 9,
        target: "opponent",
        description: "相手-9",
      },
    ],
  },
  {
    id: "strongly_condemn",
    name: "強く非難する",
    category: "colorless",
    emoji: "👊",
    description: "相手-10",
    price: 10,
    effects: [
      {
        kind: "damage",
        amount: 10,
        target: "opponent",
        description: "相手-10",
      },
    ],
  },
  {
    id: "condemn_strongest_terms",
    name: "最も強い言葉で非難する",
    category: "colorless",
    emoji: "🔥",
    description: "相手-11",
    price: 11,
    effects: [
      {
        kind: "damage",
        amount: 11,
        target: "opponent",
        description: "相手-11",
      },
    ],
  },
  {
    id: "communist_party",
    name: "共産党",
    category: "party",
    emoji: "🚩",
    description: "使用すると社会主義の政党に所属する",
    price: 5,
    effects: [],
  },
  {
    id: "ldp",
    name: "自民党",
    category: "party",
    emoji: "🏛️",
    description: "使用すると資本主義の政党に所属する",
    price: 5,
    effects: [],
  },
  {
    id: "democratic_party",
    name: "民主党",
    category: "party",
    emoji: "🗳️",
    description: "使用すると共和主義の政党に所属する",
    price: 5,
    effects: [],
  },
  {
    id: "constitutional_imperial_party",
    name: "立憲帝政党",
    category: "party",
    emoji: "👑",
    description: "使用すると封建主義の政党に所属する",
    price: 5,
    effects: [],
  },
  {
    id: "green_party",
    name: "緑の党",
    category: "party",
    emoji: "🌿",
    description: "使用すると環境主義の政党に所属する",
    price: 5,
    effects: [],
  },
  {
    id: "anarchist_party",
    name: "無政府党",
    category: "party",
    emoji: "🪬",
    description: "使用すると無政府主義の政党に所属する",
    price: 5,
    effects: [],
  },
];

export function findCard(id: string): CardDefinition | undefined {
  return BASE_CARDS.find((c) => c.id === id);
}

export function getCardsByTag(tag: string): CardDefinition[] {
  return BASE_CARDS.filter((c) => c.customTags?.includes(tag));
}

export const HAND_SIZE = 5;
export const INITIAL_HP = 20;
export const INITIAL_MP = 10;
export const INITIAL_MONEY = 20;
export const MAX_LEARNED_MIRACLES = 6;
export const DECK_SIZE = 30;

export function getCardPrice(id: string): number {
  const card = findCard(id);
  return card?.price ?? 0;
}

export function isBuyCard(id: string): boolean {
  return id === "buy";
}

export function isSellCard(id: string): boolean {
  return id === "sell";
}

export function isExchangeCard(id: string): boolean {
  return id === "exchange";
}

const PARTY_IDS: PartyId[] = [
  "communist_party",
  "ldp",
  "democratic_party",
  "constitutional_imperial_party",
  "green_party",
  "anarchist_party",
];

export function isPartyCard(id: string): boolean {
  return (PARTY_IDS as string[]).includes(id);
}

export function getPartyId(id: string): PartyId | null {
  return (PARTY_IDS as string[]).includes(id) ? (id as PartyId) : null;
}

export const PARTY_LABELS: Record<PartyId, string> = {
  communist_party: "共産党",
  ldp: "自民党",
  democratic_party: "民主党",
  constitutional_imperial_party: "立憲帝政党",
  green_party: "緑の党",
  anarchist_party: "無政府党",
};

export const PARTY_IDEOLOGIES: Record<PartyId, string> = {
  communist_party: "社会主義",
  ldp: "資本主義",
  democratic_party: "共和主義",
  constitutional_imperial_party: "封建主義",
  green_party: "環境主義",
  anarchist_party: "無政府主義",
};
