import type {
  BattleLogEntry,
  GameState,
  PartyId,
  PlayerId,
  PlayerState,
} from "@volga/shared";
import { PARTY_LABELS } from "./cards.js";
import { damagePlayer, healPlayer, recoverMp, transferMoney } from "./player.js";

export type PartyActionKind = "damage" | "heal" | "mp" | "money" | "steal";

export interface PartyAction {
  name: string;
  kind: PartyActionKind;
  amount: number;
  /** 同じ政党のアクション内での相対的な選択重み */
  weight: number;
}

export type Rng = () => number;

/** ターン終了時、所属政党を持つプレイヤーが行動する確率 */
export const PARTY_ACTION_CHANCE = 0.25;

export const PARTY_ACTIONS: Record<PartyId, readonly PartyAction[]> = {
  communist_party: [
    { name: "労働者の反撃", kind: "damage", amount: 3, weight: 60 },
    { name: "団結", kind: "mp", amount: 2, weight: 40 },
  ],
  ldp: [
    { name: "経済成長", kind: "money", amount: 3, weight: 60 },
    { name: "市場の一撃", kind: "damage", amount: 2, weight: 40 },
  ],
  democratic_party: [
    { name: "世論の追い風", kind: "mp", amount: 2, weight: 50 },
    { name: "政策協力", kind: "heal", amount: 2, weight: 50 },
  ],
  constitutional_imperial_party: [
    { name: "王権の威光", kind: "damage", amount: 3, weight: 50 },
    { name: "城塞の守り", kind: "heal", amount: 3, weight: 50 },
  ],
  green_party: [
    { name: "自然の恵み", kind: "heal", amount: 3, weight: 60 },
    { name: "再生エネルギー", kind: "mp", amount: 2, weight: 40 },
  ],
  anarchist_party: [
    { name: "直接行動", kind: "damage", amount: 2, weight: 55 },
    { name: "略奪", kind: "steal", amount: 2, weight: 45 },
  ],
};

export interface PartyActionResolution {
  state: GameState;
  logs: BattleLogEntry[];
}

function pickPartyAction(actions: readonly PartyAction[], roll: number): PartyAction {
  const total = actions.reduce((sum, action) => sum + action.weight, 0);
  let remaining = roll * total;
  for (const action of actions) {
    if (remaining < action.weight) return action;
    remaining -= action.weight;
  }
  return actions[actions.length - 1]!;
}

function determineWinner(players: PlayerState[]): PlayerId | null {
  const alive = players.filter((player) => player.hp > 0);
  return alive.length === 1 ? alive[0]!.id : null;
}

function livingOpponents(players: PlayerState[], actorId: PlayerId): PlayerState[] {
  return players.filter((player) => player.id !== actorId && player.hp > 0);
}

/**
 * ターン終了後に、終了したプレイヤー以外の生存している政党所属者の行動を解決する。
 *
 * - 各プレイヤーは独立に 25% 判定を行い、成功時は政党ごとの重み付き抽選で行動する
 * - 攻撃・略奪の対象は行動者から見た生存中の相手からランダムに選ぶ
 * - 略奪は所持金のある相手がいない場合は何もしない（ログも出さない）
 * - 誰かが勝利した時点で残りの政党行動は打ち切る
 */
export function resolvePartyActions(
  state: GameState,
  endingPlayerId: PlayerId,
  rng: Rng = Math.random,
): PartyActionResolution {
  const logs: BattleLogEntry[] = [];
  if (state.winner) return { state, logs };

  let players = state.players;
  let winner = state.winner;

  const actorIds = state.players
    .filter((player) => player.id !== endingPlayerId && player.party !== null)
    .map((player) => player.id);

  for (const actorId of actorIds) {
    const actor = players.find((player) => player.id === actorId);
    if (!actor || actor.hp <= 0 || !actor.party) continue;
    if (rng() >= PARTY_ACTION_CHANCE) continue;

    const party = actor.party;
    const actions = PARTY_ACTIONS[party];
    if (!actions || actions.length === 0) continue;
    const action = pickPartyAction(actions, rng());
    const label = PARTY_LABELS[party];

    switch (action.kind) {
      case "damage": {
        const targets = livingOpponents(players, actor.id);
        if (targets.length === 0) continue;
        const target = targets[Math.floor(rng() * targets.length)]!;
        const damaged = damagePlayer(target, action.amount);
        players = players.map((player) => (player.id === target.id ? damaged : player));
        logs.push({
          turn: state.turn,
          playerId: actor.id,
          message: `${label}が動いた！ ${action.name}: ${target.name}に${action.amount}ダメージ`,
          kind: "special",
          damage: action.amount,
        });
        break;
      }
      case "heal": {
        const healed = healPlayer(actor, action.amount);
        players = players.map((player) => (player.id === actor.id ? healed : player));
        logs.push({
          turn: state.turn,
          playerId: actor.id,
          message: `${label}が動いた！ ${action.name}: ${actor.name}のHPが${action.amount}回復`,
          kind: "special",
        });
        break;
      }
      case "mp": {
        const recovered = recoverMp(actor, action.amount);
        const gained = recovered.mp - actor.mp;
        players = players.map((player) => (player.id === actor.id ? recovered : player));
        logs.push({
          turn: state.turn,
          playerId: actor.id,
          message: `${label}が動いた！ ${action.name}: ${actor.name}のMPが${gained}回復`,
          kind: "special",
        });
        break;
      }
      case "money": {
        const richer: PlayerState = { ...actor, money: actor.money + action.amount };
        players = players.map((player) => (player.id === actor.id ? richer : player));
        logs.push({
          turn: state.turn,
          playerId: actor.id,
          message: `${label}が動いた！ ${action.name}: ${actor.name}が${action.amount}円を得た`,
          kind: "special",
        });
        break;
      }
      case "steal": {
        const targets = livingOpponents(players, actor.id).filter(
          (player) => player.money > 0,
        );
        if (targets.length === 0) continue;
        const target = targets[Math.floor(rng() * targets.length)]!;
        const transfer = transferMoney(target, actor, action.amount);
        players = players.map((player) => {
          if (player.id === target.id) return transfer.source;
          if (player.id === actor.id) return transfer.target;
          return player;
        });
        logs.push({
          turn: state.turn,
          playerId: actor.id,
          message: `${label}が動いた！ ${action.name}: ${target.name}から${transfer.actualAmount}円を奪った`,
          kind: "special",
        });
        break;
      }
    }

    winner = determineWinner(players);
    if (winner) break;
  }

  return {
    state: {
      ...state,
      players,
      winner,
      log: logs.length > 0 ? [...state.log, ...logs] : state.log,
    },
    logs,
  };
}
