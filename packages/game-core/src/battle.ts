import type {
  BattleLogEntry,
  CardRef,
  GameState,
  PlayerId,
  PlayerState,
} from "@volga/shared";
import { findCard } from "./cards.js";
import type { CardEffect } from "./cards.js";
import { buildDeck, drawCards } from "./deck.js";
import { damagePlayer, healPlayer } from "./player.js";

export const HAND_SIZE = 5;
export const INITIAL_HP = 20;
export const MAX_PLAYERS = 2;

export function createGame(
  roomId: string,
  players: { id: PlayerId; name: string }[],
): { state: GameState; deck: CardRef[] } {
  const seed = Date.now();
  let deck = buildDeck(seed);
  const initialStates: PlayerState[] = [];
  for (const p of players) {
    const { drawn, deck: next } = drawCards(deck, HAND_SIZE);
    deck = next;
    initialStates.push({
      id: p.id,
      name: p.name,
      hp: INITIAL_HP,
      maxHp: INITIAL_HP,
      hand: drawn,
      equipped: { weapon: null, shield: null, barrier: false },
      ready: false,
    });
  }
  const state: GameState = {
    roomId,
    players: initialStates,
    deckSize: deck.length,
    turn: 1,
    activePlayerIndex: 0,
    phase: "play",
    pendingAttack: null,
    log: [
      {
        turn: 1,
        playerId: players[0]?.id ?? "system",
        message: "ゲーム開始",
        kind: "system",
      },
    ],
    winner: null,
    startedAt: Date.now(),
  };
  return { state, deck };
}

interface PairResult {
  self: PlayerState;
  opponent: PlayerState;
  log: BattleLogEntry[];
}

function resolveDamage(
  target: PlayerState,
  amount: number,
  fromCardId: string,
  fromCardName: string,
  playerId: PlayerId,
  turn: number,
): { target: PlayerState; log: BattleLogEntry[] } {
  const logs: BattleLogEntry[] = [];
  if (target.equipped.barrier) {
    logs.push({
      turn,
      playerId,
      message: `${fromCardName}はバリアに阻まれた`,
      kind: "magic",
    });
    return {
      target: {
        ...target,
        equipped: { ...target.equipped, barrier: false },
      },
      log: logs,
    };
  }
  const shieldPower = target.equipped.shield?.power ?? 0;
  const reduced = Math.max(0, amount - shieldPower);
  const damaged = damagePlayer(target, reduced);
  if (reduced > 0) {
    logs.push({
      turn,
      playerId,
      message: `${target.name}が${reduced}ダメージを受けた (${fromCardName})`,
      kind: "attack",
      damage: reduced,
    });
  }
  if (shieldPower > 0 && reduced < amount) {
    logs.push({
      turn,
      playerId,
      message: `${target.name}の盾が${amount - reduced}ダメージを吸収`,
      kind: "equip",
    });
  }
  return { target: damaged, log: logs };
  void fromCardId;
}

function applyEffect(
  self: PlayerState,
  opponent: PlayerState,
  effect: CardEffect,
  cardId: string,
  cardName: string,
  turn: number,
  actorId: PlayerId,
): PairResult {
  const logs: BattleLogEntry[] = [];
  const actorName =
    self.id === actorId ? self.name : opponent.id === actorId ? opponent.name : self.name;

  switch (effect.kind) {
    case "damage": {
      const target = effect.target === "self" ? self : opponent;
      const { target: updated, log } = resolveDamage(
        target,
        effect.amount ?? 0,
        cardId,
        cardName,
        actorId,
        turn,
      );
      logs.push(
        ...log.map((l) => ({
          ...l,
          message: `${actorName}の${cardName}: ${l.message.replace(`${target.name}`, target.name)}`,
        })),
      );
      if (effect.target === "self") return { self: updated, opponent, log: logs };
      return { self, opponent: updated, log: logs };
    }
    case "heal": {
      const target = effect.target === "self" ? self : opponent;
      const before = target.hp;
      const updated = healPlayer(target, effect.amount ?? 0);
      const healed = updated.hp - before;
      if (healed > 0) {
        logs.push({
          turn,
          playerId: actorId,
          message: `${target.name}が${healed}回復 (${cardName})`,
          kind: "heal",
        });
      }
      if (effect.target === "self") return { self: updated, opponent, log: logs };
      return { self, opponent: updated, log: logs };
    }
    case "equip_weapon": {
      logs.push({
        turn,
        playerId: actorId,
        message: `${self.id === actorId ? self.name : opponent.name}が${cardName}を装備`,
        kind: "equip",
      });
      const equipped = {
        id: cardId,
        power: effect.amount ?? 0,
      };
      if (self.id === actorId) {
        return {
          self: { ...self, equipped: { ...self.equipped, weapon: equipped } },
          opponent,
          log: logs,
        };
      }
      return {
        self,
        opponent: { ...opponent, equipped: { ...opponent.equipped, weapon: equipped } },
        log: logs,
      };
    }
    case "equip_shield": {
      logs.push({
        turn,
        playerId: actorId,
        message: `${self.id === actorId ? self.name : opponent.name}が${cardName}を装備`,
        kind: "equip",
      });
      const equipped = {
        id: cardId,
        power: effect.amount ?? 0,
      };
      if (self.id === actorId) {
        return {
          self: { ...self, equipped: { ...self.equipped, shield: equipped } },
          opponent,
          log: logs,
        };
      }
      return {
        self,
        opponent: { ...opponent, equipped: { ...opponent.equipped, shield: equipped } },
        log: logs,
      };
    }
    case "barrier": {
      logs.push({
        turn,
        playerId: actorId,
        message: `${self.id === actorId ? self.name : opponent.name}がバリアを纏った`,
        kind: "magic",
      });
      if (self.id === actorId) {
        return {
          self: { ...self, equipped: { ...self.equipped, barrier: true } },
          opponent,
          log: logs,
        };
      }
      return {
        self,
        opponent: { ...opponent, equipped: { ...opponent.equipped, barrier: true } },
        log: logs,
      };
    }
    case "steal_weapon": {
      const target = opponent;
      const stolen = target.equipped.weapon;
      if (!stolen) {
        logs.push({
          turn,
          playerId: actorId,
          message: `${cardName}: 奪える武器がない`,
          kind: "special",
        });
        return { self, opponent, log: logs };
      }
      logs.push({
        turn,
        playerId: actorId,
        message: `${self.id === actorId ? self.name : opponent.name}が${opponent.name}の武器を奪った`,
        kind: "special",
      });
      if (self.id === actorId) {
        return {
          self: { ...self, equipped: { ...self.equipped, weapon: stolen } },
          opponent: { ...opponent, equipped: { ...opponent.equipped, weapon: null } },
          log: logs,
        };
      }
      return {
        self: { ...self, equipped: { ...self.equipped, weapon: stolen } },
        opponent: { ...opponent, equipped: { ...opponent.equipped, weapon: null } },
        log: logs,
      };
    }
    case "steal_shield": {
      const stolen = opponent.equipped.shield;
      if (!stolen) {
        logs.push({
          turn,
          playerId: actorId,
          message: `${cardName}: 奪える盾がない`,
          kind: "special",
        });
        return { self, opponent, log: logs };
      }
      logs.push({
        turn,
        playerId: actorId,
        message: `${self.id === actorId ? self.name : opponent.name}が${opponent.name}の盾を奪った`,
        kind: "special",
      });
      if (self.id === actorId) {
        return {
          self: { ...self, equipped: { ...self.equipped, shield: stolen } },
          opponent: { ...opponent, equipped: { ...opponent.equipped, shield: null } },
          log: logs,
        };
      }
      return {
        self,
        opponent: { ...opponent, equipped: { ...opponent.equipped, shield: stolen } },
        log: logs,
      };
    }
    case "destroy_weapon": {
      if (!opponent.equipped.weapon) {
        return { self, opponent, log: logs };
      }
      logs.push({
        turn,
        playerId: actorId,
        message: `${opponent.name}の武器を破壊した`,
        kind: "special",
      });
      return {
        self,
        opponent: { ...opponent, equipped: { ...opponent.equipped, weapon: null } },
        log: logs,
      };
    }
    case "destroy_shield": {
      if (!opponent.equipped.shield) {
        return { self, opponent, log: logs };
      }
      logs.push({
        turn,
        playerId: actorId,
        message: `${opponent.name}の盾を破壊した`,
        kind: "special",
      });
      return {
        self,
        opponent: { ...opponent, equipped: { ...opponent.equipped, shield: null } },
        log: logs,
      };
    }
  }
}

export function playCard(
  state: GameState,
  playerId: PlayerId,
  cardRef: CardRef,
  targetPlayerId?: PlayerId,
): { ok: true; state: GameState; deck: CardRef[] } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };
  const idx = active.hand.findIndex((c) => c.id === cardRef.id);
  if (idx === -1) return { ok: false, reason: "card not in hand" };
  const card = findCard(cardRef.id);
  if (!card) return { ok: false, reason: "unknown card" };

  const newHand = [...active.hand];
  newHand.splice(idx, 1);

  let self: PlayerState = { ...active, hand: newHand };
  let opponent =
    state.players.find((p) => p.id === targetPlayerId && p.id !== playerId) ??
    state.players.find((p) => p.id !== playerId) ??
    state.players[0]!;
  const logs: BattleLogEntry[] = [];
  const pendingDamage = card.effects
    .filter((effect) => effect.kind === "damage" && effect.target === "opponent")
    .reduce((total, effect) => total + (effect.amount ?? 0), 0);

  if (pendingDamage > 0) {
    for (const effect of card.effects.filter(
      (effect) => !(effect.kind === "damage" && effect.target === "opponent"),
    )) {
      const result = applyEffect(
        self,
        opponent,
        effect,
        card.id,
        card.name,
        state.turn,
        playerId,
      );
      self = result.self;
      opponent = result.opponent;
      logs.push(...result.log);
    }

    const finalPlayers = state.players.map((p) => {
      if (p.id === playerId) return self;
      return opponent;
    });

    return {
      ok: true,
      state: {
        ...state,
        players: finalPlayers,
        phase: "defense",
        pendingAttack: {
          attackerId: playerId,
          defenderId: opponent.id,
          card: { id: card.id },
          cardName: card.name,
          amount: pendingDamage,
        },
        log: [
          ...state.log,
          ...logs,
          {
            turn: state.turn,
            playerId,
            message: `${self.name}が${card.name}で攻撃`,
            kind: "attack",
          },
        ],
      },
      deck: [],
    };
  }

  for (const effect of card.effects) {
    const result = applyEffect(
      self,
      opponent,
      effect,
      card.id,
      card.name,
      state.turn,
      playerId,
    );
    self = result.self;
    opponent = result.opponent;
    logs.push(...result.log);
  }

  const finalPlayers = state.players.map((p) => {
    if (p.id === playerId) return self;
    return opponent;
  });

  let winner: PlayerId | null = null;
  if (self.hp <= 0 && opponent.hp <= 0) {
    winner = null;
  } else if (opponent.hp <= 0) {
    winner = playerId;
  } else if (self.hp <= 0) {
    winner = opponent.id;
  }

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    phase: "play",
    pendingAttack: null,
    log: [...state.log, ...logs],
    winner,
  };

  if (winner) {
    newState.log.push({
      turn: state.turn,
      playerId: winner,
      message: `${finalPlayers.find((p) => p.id === winner)?.name ?? "?"}の勝利!`,
      kind: "system",
    });
  }

  return { ok: true, state: newState, deck: [] };
}

export function defendAttack(
  state: GameState,
  playerId: PlayerId,
  cardRef?: CardRef,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const pending = state.pendingAttack;
  if (!pending || state.phase !== "defense") {
    return { ok: false, reason: "no attack to defend" };
  }
  if (pending.defenderId !== playerId) return { ok: false, reason: "not defending player" };

  let attacker = state.players.find((p) => p.id === pending.attackerId);
  let defender = state.players.find((p) => p.id === pending.defenderId);
  if (!attacker || !defender) return { ok: false, reason: "player not found" };

  const logs: BattleLogEntry[] = [];
  let defensePower = 0;
  let nextHand = defender.hand;

  if (cardRef) {
    const idx = defender.hand.findIndex((c) => c.id === cardRef.id);
    if (idx === -1) return { ok: false, reason: "card not in hand" };
    const card = findCard(cardRef.id);
    const shieldEffect = card?.effects.find((effect) => effect.kind === "equip_shield");
    if (!card || !shieldEffect) return { ok: false, reason: "not a defense card" };
    defensePower = shieldEffect.amount ?? 0;
    nextHand = [...defender.hand];
    nextHand.splice(idx, 1);
    defender = { ...defender, hand: nextHand };
    logs.push({
      turn: state.turn,
      playerId,
      message: `${defender.name}が${card.name}で防御`,
      kind: "equip",
    });
  }

  const { target: damaged, log } = resolveDamage(
    defender,
    Math.max(0, pending.amount - defensePower),
    pending.card.id,
    pending.cardName,
    pending.attackerId,
    state.turn,
  );
  defender = damaged;
  logs.push(...log);

  let winner: PlayerId | null = null;
  if (defender.hp <= 0) winner = attacker.id;

  const finalPlayers = state.players.map((p) => {
    if (p.id === attacker!.id) return attacker!;
    if (p.id === defender!.id) return defender!;
    return p;
  });

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    phase: "play",
    pendingAttack: null,
    log: [...state.log, ...logs],
    winner,
  };

  if (winner) {
    newState.log.push({
      turn: state.turn,
      playerId: winner,
      message: `${attacker.name}の勝利!`,
      kind: "system",
    });
  }

  return { ok: true, state: newState };
}

export function endTurn(
  state: GameState,
  playerId: PlayerId,
  deck: CardRef[],
): { ok: true; state: GameState; deck: CardRef[] } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };

  let self = active;
  let opponent =
    state.players.find((p) => p.id !== playerId) ?? state.players[0]!;
  const logs: BattleLogEntry[] = [];

  if (self.equipped.weapon) {
    const dmg = self.equipped.weapon.power;
    const { target: updated, log } = resolveDamage(
      opponent,
      dmg,
      self.equipped.weapon.id,
      "武器攻撃",
      playerId,
      state.turn,
    );
    opponent = updated;
    logs.push(...log);
  }

  let newDeck = deck;
  let drawn: CardRef[] = [];
  const deficit = HAND_SIZE - self.hand.length;
  if (deficit > 0 && newDeck.length > 0) {
    const result = drawCards(newDeck, deficit);
    drawn = result.drawn;
    newDeck = result.deck;
    self = { ...self, hand: [...self.hand, ...drawn] };
    logs.push({
      turn: state.turn,
      playerId,
      message: `${self.name}が${drawn.length}枚ドロー`,
      kind: "system",
    });
  }

  let winner: PlayerId | null = null;
  if (opponent.hp <= 0 && self.hp <= 0) {
    winner = null;
  } else if (opponent.hp <= 0) {
    winner = playerId;
  } else if (self.hp <= 0) {
    winner = opponent.id;
  }

  const nextIdx = (state.activePlayerIndex + 1) % state.players.length;
  const newTurn = nextIdx === 0 ? state.turn + 1 : state.turn;

  const finalPlayers = state.players.map((p) => {
    if (p.id === playerId) return self;
    return opponent;
  });

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    activePlayerIndex: nextIdx,
    turn: newTurn,
    deckSize: newDeck.length,
    phase: "play",
    pendingAttack: null,
    log: [...state.log, ...logs],
    winner,
  };

  if (winner) {
    newState.log.push({
      turn: newState.turn,
      playerId: winner,
      message: `${finalPlayers.find((p) => p.id === winner)?.name ?? "?"}の勝利!`,
      kind: "system",
    });
  }

  return { ok: true, state: newState, deck: newDeck };
}

export function listPlayers(state: GameState): PlayerState[] {
  return state.players;
}
