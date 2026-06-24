import type { CardCategory } from "@volga/shared";

export type Target = "self" | "opponent" | "either";

export interface CardEffect {
  kind: "damage" | "heal" | "defense";
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
  customTags?: string[];
}

export const BASE_CARDS: CardDefinition[] = [
  {
    id: "sword",
    name: "剣",
    category: "weapon",
    emoji: "⚔️",
    description: "相手-3",
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
    id: "shield",
    name: "盾",
    category: "shield",
    emoji: "🛡️",
    description: "防御力+3",
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
export const MAX_LEARNED_MIRACLES = 6;
export const DECK_SIZE = 30;
