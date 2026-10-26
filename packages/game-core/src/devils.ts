import type { BattleLogEntry, PlayerState } from "@volga/shared";
import { damagePlayer, healPlayer } from "./player.js";
import type { Rng } from "./parties.js";

export type DevilEffectKind = "damage" | "discard" | "heal";

export interface DevilEffect {
  kind: DevilEffectKind;
  amount: number;
}

export interface DoomsdayDevil {
  id: string;
  name: string;
  emoji: string;
  /** 悪魔が起こす行動の名前 */
  action: string;
  effect: DevilEffect;
  /** 終末の時に選ばれる相対的な重み */
  weight: number;
  description: string;
}

/** 終末の時、手札を補充するために1枚引くたびに悪魔が現れる確率 */
export const DOOMSDAY_DEVIL_RATE = 0.25;

export const DOOMSDAY_DEVILS: readonly DoomsdayDevil[] = [
  {
    id: "trump",
    name: "トランプ大統領",
    emoji: "🇺🇸",
    action: "ツイート砲",
    effect: { kind: "damage", amount: 10 },
    weight: 7,
    description: "SNSに投稿を乱射して攻撃する。10ダメージ",
  },
  {
    id: "putin",
    name: "プーチン大統領",
    emoji: "🐻",
    action: "特別軍事作戦",
    effect: { kind: "damage", amount: 20 },
    weight: 5,
    description: "軍事作戦を強行する。20ダメージ",
  },
  {
    id: "kim_jong_un",
    name: "金正恩委員長",
    emoji: "🚀",
    action: "ミサイル発射",
    effect: { kind: "damage", amount: 30 },
    weight: 3,
    description: "ミサイルを発射する。30ダメージ",
  },
  {
    id: "elon_musk",
    name: "イーロン・マスク",
    emoji: "🐦",
    action: "アカウント凍結",
    effect: { kind: "discard", amount: 2 },
    weight: 5,
    description: "神器を2枚凍結して使えなくする",
  },
  {
    id: "boj_governor",
    name: "日銀総裁",
    emoji: "🏦",
    action: "金融緩和",
    effect: { kind: "heal", amount: 10 },
    weight: 5,
    description: "金融緩和でHPを10回復する（HP上限なし）",
  },
];

/** 重み付き抽選で悪魔を1体選ぶ。境界は累積重みの手前まで。 */
export function pickDoomsdayDevil(rng: Rng = Math.random): DoomsdayDevil {
  const total = DOOMSDAY_DEVILS.reduce((sum, devil) => sum + devil.weight, 0);
  let roll = rng() * total;
  for (const devil of DOOMSDAY_DEVILS) {
    if (roll < devil.weight) return devil;
    roll -= devil.weight;
  }
  return DOOMSDAY_DEVILS[DOOMSDAY_DEVILS.length - 1]!;
}

/**
 * 終末の時の悪魔出現判定。25%を引けなければ null を返す。
 * 成功時は続けて重み付き抽選を行う。
 */
export function rollDoomsdayDevil(rng: Rng = Math.random): DoomsdayDevil | null {
  if (rng() >= DOOMSDAY_DEVIL_RATE) return null;
  return pickDoomsdayDevil(rng);
}

export interface DevilApplication {
  player: PlayerState;
  log: BattleLogEntry;
}

/**
 * 悪魔の効果をプレイヤーに適用し、更新後のプレイヤーとログを返す。
 * - damage: HPを減らす（0未満にはならない）
 * - discard: 手札の末尾から最大2枚を捨てる（2枚未満でも落ちない）
 * - heal: HPを回復する（HP20を超えてよい）
 */
export function applyDoomsdayDevil(
  devil: DoomsdayDevil,
  player: PlayerState,
  turn: number,
): DevilApplication {
  switch (devil.effect.kind) {
    case "damage": {
      const amount = devil.effect.amount;
      return {
        player: damagePlayer(player, amount),
        log: {
          turn,
          playerId: player.id,
          message: `終末の時: ${devil.emoji}${devil.name}が現れ、${devil.action}！ ${player.name}が${amount}ダメージを受けた`,
          kind: "system",
          damage: amount,
        },
      };
    }
    case "discard": {
      const discarded = Math.min(devil.effect.amount, player.hand.length);
      const hand = player.hand.slice(0, player.hand.length - discarded);
      return {
        player: { ...player, hand },
        log: {
          turn,
          playerId: player.id,
          message: `終末の時: ${devil.emoji}${devil.name}が現れ、${devil.action}！ ${player.name}の神器を${discarded}枚捨てた`,
          kind: "system",
        },
      };
    }
    case "heal": {
      const healedPlayer = healPlayer(player, devil.effect.amount);
      const healed = healedPlayer.hp - player.hp;
      return {
        player: healedPlayer,
        log: {
          turn,
          playerId: player.id,
          message: `終末の時: ${devil.emoji}${devil.name}が現れ、${devil.action}！ ${player.name}のHPが${healed}回復した`,
          kind: "system",
        },
      };
    }
  }
}
