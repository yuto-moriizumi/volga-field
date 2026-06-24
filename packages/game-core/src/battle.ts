import type {
  BattleLogEntry,
  CardRef,
  DoomsdayTurn,
  GameState,
  PlayerId,
  PlayerState,
} from "@volga/shared";
import { findCard } from "./cards.js";
import type { CardEffect } from "./cards.js";
import { MAX_LEARNED_MIRACLES, INITIAL_MP } from "./cards.js";
import { buildDeck, drawCards } from "./deck.js";
import { damagePlayer, healPlayer, spendMp } from "./player.js";

export const HAND_SIZE = 5;
export const INITIAL_HP = 20;
export const MAX_PLAYERS = 9;
const DOOMSDAY_EVENT_RATE = 0.25;

const DOOMSDAY_EVENTS = [
  { name: "小悪魔", weight: 7, damage: 10 },
  { name: "中悪魔", weight: 5, damage: 20 },
  { name: "大悪魔", weight: 3, damage: 30 },
  { name: "イタズラマン", weight: 5, discard: 2 },
  { name: "めぐみの妖精", weight: 5, heal: 10 },
] as const;

export function createGame(
  roomId: string,
  players: { id: PlayerId; name: string }[],
  options: { doomsdayTurn?: DoomsdayTurn | null } = {},
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
      mp: INITIAL_MP,
      maxMp: INITIAL_MP,
      hand: drawn,
      learnedMiracles: [],
      ready: false,
    });
  }
  const state: GameState = {
    roomId,
    players: initialStates,
    deckSize: deck.length,
    turn: 1,
    actionTurn: 1,
    doomsdayTurn: options.doomsdayTurn ?? null,
    doomsdayActive: false,
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

function pickDoomsdayEvent() {
  const total = DOOMSDAY_EVENTS.reduce((sum, event) => sum + event.weight, 0);
  let roll = Math.random() * total;
  for (const event of DOOMSDAY_EVENTS) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return DOOMSDAY_EVENTS[0]!;
}

function applyDoomsdayEvent(
  player: PlayerState,
  turn: number,
): { player: PlayerState; log: BattleLogEntry | null } {
  if (Math.random() >= DOOMSDAY_EVENT_RATE) return { player, log: null };

  const event = pickDoomsdayEvent();
  if ("damage" in event) {
    return {
      player: damagePlayer(player, event.damage),
      log: {
        turn,
        playerId: player.id,
        message: `終末の時: ${event.name}が現れ、${player.name}が${event.damage}ダメージを受けた`,
        kind: "system",
        damage: event.damage,
      },
    };
  }
  if ("discard" in event) {
    const nextHand = player.hand.slice(0, Math.max(0, player.hand.length - event.discard));
    const discarded = player.hand.length - nextHand.length;
    return {
      player: { ...player, hand: nextHand },
      log: {
        turn,
        playerId: player.id,
        message: `終末の時: ${event.name}が現れ、${player.name}の神器を${discarded}枚捨てた`,
        kind: "system",
      },
    };
  }

  const healed = healPlayer(player, event.heal);
  return {
    player: healed,
    log: {
      turn,
      playerId: player.id,
      message: `終末の時: ${event.name}が現れ、${player.name}のHPが${healed.hp - player.hp}回復した`,
      kind: "system",
    },
  };
}

function determineWinner(players: PlayerState[]): PlayerId | null {
  const alive = players.filter((p) => p.hp > 0);
  return alive.length === 1 ? alive[0]!.id : null;
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
  const damaged = damagePlayer(target, amount);
  if (amount > 0) {
    logs.push({
      turn,
      playerId,
      message: `${target.name}が${amount}ダメージを受けた (${fromCardName})`,
      kind: "attack",
      damage: amount,
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
    case "defense":
      return { self, opponent, log: logs };
  }
}

export function playCard(
  state: GameState,
  playerId: PlayerId,
  cardRef: CardRef,
  targetPlayerId?: PlayerId,
  deck: CardRef[] = [],
): { ok: true; state: GameState; deck: CardRef[] } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };
  const card = findCard(cardRef.id);
  if (!card) return { ok: false, reason: "unknown card" };
  const idx = active.hand.findIndex((c) => c.id === cardRef.id);
  const learnedMiracle = active.learnedMiracles.some((c) => c.id === cardRef.id);
  const isMiracle = card.category === "miracle";
  if (idx === -1 && !(isMiracle && learnedMiracle)) {
    return { ok: false, reason: "card not in hand" };
  }
  const mpCost = isMiracle ? (card.mpCost ?? 0) : 0;
  if (mpCost > active.mp) return { ok: false, reason: "not enough MP" };

  const newHand = [...active.hand];
  if (idx !== -1) newHand.splice(idx, 1);

  const nextLearnedMiracles =
    isMiracle && !learnedMiracle
      ? [...active.learnedMiracles, { id: card.id }].slice(-MAX_LEARNED_MIRACLES)
      : active.learnedMiracles;
  let self: PlayerState = spendMp(
    { ...active, hand: newHand, learnedMiracles: nextLearnedMiracles },
    mpCost,
  );
  let newDeck = deck;
  const miracleLogs: BattleLogEntry[] = [];
  if (isMiracle) {
    if (!learnedMiracle) {
      miracleLogs.push({
        turn: state.turn,
        playerId,
        message: `${active.name}が${card.name}を習得`,
        kind: "miracle",
      });
    }
    if (mpCost > 0) {
      miracleLogs.push({
        turn: state.turn,
        playerId,
        message: `${active.name}がMP${mpCost}を消費 (${card.name})`,
        kind: "miracle",
      });
    }
    if (newDeck.length > 0 && self.hand.length < HAND_SIZE) {
      const result = drawCards(newDeck, 1);
      newDeck = result.deck;
      self = { ...self, hand: [...self.hand, ...result.drawn] };
      miracleLogs.push({
        turn: state.turn,
        playerId,
        message: `${active.name}が奇跡の効果で神器を1枚授かった`,
        kind: "miracle",
      });
    }
  }
  let opponent =
    state.players.find((p) => p.id === targetPlayerId && p.id !== playerId) ??
    state.players.find((p) => p.id !== playerId) ??
    state.players[0]!;
  const logs: BattleLogEntry[] = [...miracleLogs];
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
      if (p.id === opponent.id) return opponent;
      return p;
    });

    return {
      ok: true,
      state: {
        ...state,
        players: finalPlayers,
        deckSize: newDeck.length,
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
      deck: newDeck,
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
    if (p.id === opponent.id) return opponent;
    return p;
  });
  const winner = determineWinner(finalPlayers);

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    deckSize: newDeck.length,
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

  return { ok: true, state: newState, deck: newDeck };
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
    const defenseEffect = card?.effects.find((effect) => effect.kind === "defense");
    if (!card || !defenseEffect) return { ok: false, reason: "not a defense card" };
    defensePower = defenseEffect.amount ?? 0;
    nextHand = [...defender.hand];
    nextHand.splice(idx, 1);
    defender = { ...defender, hand: nextHand };
    logs.push({
      turn: state.turn,
      playerId,
      message: `${defender.name}が${card.name}で防御`,
      kind: "defense",
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

  const finalPlayers = state.players.map((p) => {
    if (p.id === attacker!.id) return attacker!;
    if (p.id === defender!.id) return defender!;
    return p;
  });
  const winner = determineWinner(finalPlayers);

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

  let newDeck = deck;
  let drawn: CardRef[] = [];
  const deficit = HAND_SIZE - self.hand.length;
  if (deficit > 0 && newDeck.length > 0) {
    if (state.doomsdayActive) {
      for (let i = 0; i < deficit; i++) {
        const result = applyDoomsdayEvent(self, state.turn);
        self = result.player;
        if (result.log) logs.push(result.log);
      }
    }
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

  const nextIdx = (state.activePlayerIndex + 1) % state.players.length;
  const newTurn = nextIdx === 0 ? state.turn + 1 : state.turn;
  const newActionTurn = state.actionTurn + 1;
  const doomsdayActive =
    state.doomsdayActive ||
    (state.doomsdayTurn !== null && newActionTurn >= state.doomsdayTurn);

  if (!state.doomsdayActive && doomsdayActive) {
    logs.push({
      turn: newTurn,
      playerId,
      message: `終末の時 G.F.${state.doomsdayTurn} が訪れた`,
      kind: "system",
    });
  }

  const finalPlayers = state.players.map((p) => {
    if (p.id === playerId) return self;
    if (p.id === opponent.id) return opponent;
    return p;
  });
  const winner = determineWinner(finalPlayers);

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    activePlayerIndex: nextIdx,
    turn: newTurn,
    actionTurn: newActionTurn,
    doomsdayActive,
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
