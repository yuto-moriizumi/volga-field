import type {
  BattleLogEntry,
  CardRef,
  DoomsdayTurn,
  GameState,
  PlayerId,
  PlayerState,
} from "@volga/shared";
import { findCard } from "./cards.js";
import type { CardDefinition, CardEffect } from "./cards.js";
import {
  MAX_LEARNED_MIRACLES,
  INITIAL_MONEY,
  INITIAL_MP,
  getCardPrice,
} from "./cards.js";
import { buildDeck, drawCards } from "./deck.js";
import {
  chargePlayer,
  damagePlayer,
  healPlayer,
  recoverMp,
  spendMp,
  transferMoney,
} from "./player.js";

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
      money: INITIAL_MONEY,
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
    pendingBuy: null,
    pendingSell: null,
    pendingExchange: null,
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
    case "mpRecover": {
      const target = effect.target === "self" ? self : opponent;
      const before = target.mp;
      const updated = recoverMp(target, effect.amount ?? 0);
      const recovered = updated.mp - before;
      if (recovered > 0) {
        logs.push({
          turn,
          playerId: actorId,
          message: `${target.name}のMPが${recovered}回復 (${cardName})`,
          kind: "mpRecover",
        });
      }
      if (effect.target === "self") return { self: updated, opponent, log: logs };
      return { self, opponent: updated, log: logs };
    }
    case "defense":
      return { self, opponent, log: logs };
    case "attack_power":
      return { self, opponent, log: logs };
  }
}

export function playCard(
  state: GameState,
  playerId: PlayerId,
  cardRef: CardRef | CardRef[],
  targetPlayerId?: PlayerId,
  deck: CardRef[] = [],
): { ok: true; state: GameState; deck: CardRef[] } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };

  const cardRefs = (Array.isArray(cardRef) ? cardRef : [cardRef]).filter(
    (ref) => ref && typeof ref.id === "string" && ref.id.length > 0,
  );
  if (cardRefs.length === 0) return { ok: false, reason: "no card to play" };

  const cards: CardDefinition[] = [];
  for (const ref of cardRefs) {
    const card = findCard(ref.id);
    if (!card) return { ok: false, reason: "unknown card" };
    if (card.category === "trade") {
      return { ok: false, reason: "trade card needs special handler" };
    }
    if (card.effects.every((effect) => effect.kind === "defense")) {
      return { ok: false, reason: "defense card can only be used while defending" };
    }
    cards.push(card);
  }

  let newHand = [...active.hand];
  let totalMpCost = 0;
  for (const card of cards) {
    const idx = newHand.findIndex((c) => c.id === card.id);
    const learnedMiracle = active.learnedMiracles.some((c) => c.id === card.id);
    const isMiracle = card.category === "miracle";
    if (idx === -1 && !(isMiracle && learnedMiracle)) {
      return { ok: false, reason: "card not in hand" };
    }
    if (idx !== -1) {
      newHand.splice(idx, 1);
    }
    if (isMiracle) {
      totalMpCost += card.mpCost ?? 0;
    }
  }
  if (totalMpCost > active.mp) return { ok: false, reason: "not enough MP" };

  let nextLearnedMiracles = active.learnedMiracles;
  for (const card of cards) {
    if (card.category === "miracle") {
      const learned = nextLearnedMiracles.some((c) => c.id === card.id);
      if (!learned) {
        nextLearnedMiracles = [...nextLearnedMiracles, { id: card.id }].slice(
          -MAX_LEARNED_MIRACLES,
        );
      }
    }
  }
  let self: PlayerState = spendMp(
    { ...active, hand: newHand, learnedMiracles: nextLearnedMiracles },
    totalMpCost,
  );
  let newDeck = deck;
  const miracleLogs: BattleLogEntry[] = [];
  for (const card of cards) {
    const learned = active.learnedMiracles.some((c) => c.id === card.id);
    if (card.category === "miracle") {
      if (!learned) {
        miracleLogs.push({
          turn: state.turn,
          playerId,
          message: `${active.name}が${card.name}を習得`,
          kind: "miracle",
        });
      }
      if ((card.mpCost ?? 0) > 0) {
        miracleLogs.push({
          turn: state.turn,
          playerId,
          message: `${active.name}がMP${card.mpCost}を消費 (${card.name})`,
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
  }
  let opponent =
    state.players.find((p) => p.id === targetPlayerId && p.id !== playerId) ??
    state.players.find((p) => p.id !== playerId) ??
    state.players[0]!;
  const logs: BattleLogEntry[] = [...miracleLogs];
  const pendingDamage = cards.reduce((total, card) => {
    const direct = card.effects
      .filter((effect) => effect.kind === "damage" && effect.target === "opponent")
      .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
    const power = card.effects
      .filter((effect) => effect.kind === "attack_power")
      .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
    return total + direct + power;
  }, 0);

  if (pendingDamage > 0) {
    for (const card of cards) {
      for (const effect of card.effects.filter(
        (effect) =>
          !(effect.kind === "damage" && effect.target === "opponent") &&
          effect.kind !== "attack_power",
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
    }

    const finalPlayers = state.players.map((p) => {
      if (p.id === playerId) return self;
      if (p.id === opponent.id) return opponent;
      return p;
    });

    const combinedName =
      cards.length === 1 ? cards[0]!.name : cards.map((c) => c.name).join("+");
    const primaryCard = cards[0]!;

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
          card: { id: primaryCard.id },
          cardName: combinedName,
          amount: pendingDamage,
        },
        log: [
          ...state.log,
          ...logs,
          {
            turn: state.turn,
            playerId,
            message: `${self.name}が${combinedName}で攻撃`,
            kind: "attack",
          },
        ],
      },
      deck: newDeck,
    };
  }

  for (const card of cards) {
    for (const effect of card.effects.filter(
      (effect) =>
        !(effect.kind === "damage" && effect.target === "opponent") &&
        effect.kind !== "attack_power",
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
  cardRefs: CardRef | CardRef[] = [],
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
  const selectedCardRefs = Array.isArray(cardRefs) ? cardRefs : [cardRefs];

  if (selectedCardRefs.length > 0) {
    nextHand = [...defender.hand];
  }

  for (const cardRef of selectedCardRefs) {
    const idx = nextHand.findIndex((c) => c.id === cardRef.id);
    if (idx === -1) return { ok: false, reason: "card not in hand" };
    const card = findCard(cardRef.id);
    const defenseEffect = card?.effects.find((effect) => effect.kind === "defense");
    if (!card || !defenseEffect) return { ok: false, reason: "not a defense card" };
    defensePower += defenseEffect.amount ?? 0;
    nextHand.splice(idx, 1);
    logs.push({
      turn: state.turn,
      playerId,
      message: `${defender.name}が${card.name}で防御`,
      kind: "defense",
    });
  }
  defender = { ...defender, hand: nextHand };

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

export function discardCards(
  state: GameState,
  playerId: PlayerId,
  cardRefs: CardRef[],
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };
  if (cardRefs.length === 0) return { ok: false, reason: "no cards selected" };

  const nextHand = [...active.hand];
  const discardedNames: string[] = [];
  for (const cardRef of cardRefs) {
    const idx = nextHand.findIndex((c) => c.id === cardRef.id);
    if (idx === -1) return { ok: false, reason: "card not in hand" };
    const [removed] = nextHand.splice(idx, 1);
    const card = removed ? findCard(removed.id) : null;
    discardedNames.push(card?.name ?? removed?.id ?? "?");
  }

  const finalPlayers = state.players.map((p) =>
    p.id === playerId ? { ...active, hand: nextHand } : p,
  );

  return {
    ok: true,
    state: {
      ...state,
      players: finalPlayers,
      log: [
        ...state.log,
        {
          turn: state.turn,
          playerId,
          message: `${active.name}が${discardedNames.length}枚捨てた (${discardedNames.join("、")})`,
          kind: "system",
        },
      ],
    },
  };
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

export function startBuy(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };
  if (state.pendingBuy) return { ok: false, reason: "buy already pending" };
  if (state.pendingSell) return { ok: false, reason: "sell already pending" };

  const buyIdx = active.hand.findIndex((c) => c.id === "buy");
  if (buyIdx === -1) return { ok: false, reason: "buy card not in hand" };

  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target) return { ok: false, reason: "target not found" };
  if (target.id === playerId) return { ok: false, reason: "cannot buy from self" };
  if (target.hand.length === 0) return { ok: false, reason: "target has no cards" };

  const tradeableCards = target.hand.filter((c) => c.id !== "buy" && c.id !== "sell");
  const pool = tradeableCards.length > 0 ? tradeableCards : target.hand;
  const pickIdx = Math.floor(Math.random() * pool.length);
  const pickedCard = pool[pickIdx]!;
  const price = getCardPrice(pickedCard.id);

  const newHand = [...active.hand];
  newHand.splice(buyIdx, 1);

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hand: newHand } : p,
  );

  return {
    ok: true,
    state: {
      ...state,
      players: updatedPlayers,
      pendingBuy: {
        sourceId: playerId,
        targetId: target.id,
        card: { id: pickedCard.id },
        cardName: findCard(pickedCard.id)?.name ?? pickedCard.id,
        price,
      },
      log: [
        ...state.log,
        {
          turn: state.turn,
          playerId,
          message: `${active.name}が買う札を使った → ${target.name}の手札から${findCard(pickedCard.id)?.name ?? pickedCard.id}が提示された`,
          kind: "trade",
        },
      ],
    },
  };
}

export function confirmBuy(
  state: GameState,
  playerId: PlayerId,
  accept: boolean,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const pending = state.pendingBuy;
  if (!pending) return { ok: false, reason: "no pending buy" };
  if (pending.sourceId !== playerId) return { ok: false, reason: "not your buy" };

  let source = state.players.find((p) => p.id === pending.sourceId);
  let target = state.players.find((p) => p.id === pending.targetId);
  if (!source || !target) return { ok: false, reason: "player not found" };

  const logs: BattleLogEntry[] = [];
  const finalPlayers: PlayerState[] = [];

  if (accept && source.money >= pending.price) {
    const sourceTargetIdx = target.hand.findIndex((c) => c.id === pending.card.id);
    if (sourceTargetIdx === -1) {
      logs.push({
        turn: state.turn,
        playerId,
        message: `${target.name}の手札に${pending.cardName}が見つからなかった`,
        kind: "trade",
      });
    } else {
      const newTargetHand = [...target.hand];
      newTargetHand.splice(sourceTargetIdx, 1);
      target = { ...target, hand: newTargetHand };
      const sourceWithCard = { ...source, hand: [...source.hand, { id: pending.card.id }] };
      const transfer = transferMoney(sourceWithCard, target, pending.price);
      source = transfer.source;
      target = transfer.target;
      logs.push({
        turn: state.turn,
        playerId,
        message: `${source.name}が${pending.cardName}を${pending.price}円で買った`,
        kind: "trade",
      });
    }
  } else {
    logs.push({
      turn: state.turn,
      playerId,
      message: `${source.name}は${pending.cardName}を買わなかった`,
      kind: "trade",
    });
  }

  for (const p of state.players) {
    if (p.id === source.id) finalPlayers.push(source);
    else if (p.id === target.id) finalPlayers.push(target);
    else finalPlayers.push(p);
  }

  const winner = determineWinner(finalPlayers);

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    pendingBuy: null,
    winner,
    log: [...state.log, ...logs],
  };

  if (winner) {
    newState.log.push({
      turn: newState.turn,
      playerId: winner,
      message: `${finalPlayers.find((p) => p.id === winner)?.name ?? "?"}の勝利!`,
      kind: "system",
    });
  }

  return { ok: true, state: newState };
}

export function sellCards(
  state: GameState,
  playerId: PlayerId,
  cardRefs: CardRef[],
  targetPlayerId: PlayerId,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };
  if (state.pendingBuy) return { ok: false, reason: "buy pending" };
  if (state.pendingSell) return { ok: false, reason: "sell pending" };
  if (cardRefs.length === 0) return { ok: false, reason: "no cards selected" };

  const sellIdx = active.hand.findIndex((c) => c.id === "sell");
  if (sellIdx === -1) return { ok: false, reason: "sell card not in hand" };

  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target) return { ok: false, reason: "target not found" };
  if (target.id === playerId) return { ok: false, reason: "cannot sell to self" };

  const nextHand = [...active.hand];
  const sellable: CardRef[] = [];
  const sellableNames: string[] = [];
  for (const cardRef of cardRefs) {
    if (cardRef.id === "sell") return { ok: false, reason: "cannot sell the sell card" };
    const idx = nextHand.findIndex((c) => c.id === cardRef.id);
    if (idx === -1) return { ok: false, reason: "card not in hand" };
    nextHand.splice(idx, 1);
    sellable.push({ id: cardRef.id });
    sellableNames.push(findCard(cardRef.id)?.name ?? cardRef.id);
  }
  nextHand.splice(sellIdx, 1);

  const totalPrice = sellable.reduce((sum, c) => sum + getCardPrice(c.id), 0);

  const charge = chargePlayer(target, totalPrice);
  const updatedTarget: PlayerState = {
    ...charge.player,
    hand: [...charge.player.hand, ...sellable],
  };

  let updatedSeller: PlayerState = {
    ...active,
    hand: nextHand,
    money: active.money + totalPrice,
  };

  const logs: BattleLogEntry[] = [
    {
      turn: state.turn,
      playerId,
      message: `${active.name}が${target.name}へ${sellableNames.join("、")}を${totalPrice}円で売りつけた`,
      kind: "trade",
    },
  ];

  if (charge.moneyPaid < totalPrice) {
    const deficit = totalPrice - charge.moneyPaid;
    const mpPart = charge.mpPaid > 0 ? `MP-${charge.mpPaid}` : "";
    const hpPart = charge.hpPaid > 0 ? `HP-${charge.hpPaid}` : "";
    const detail = [mpPart, hpPart].filter(Boolean).join(" / ");
    if (detail) {
      logs.push({
        turn: state.turn,
        playerId: target.id,
        message: `${target.name}は代金の不足分${deficit}円を${detail}で支払った`,
        kind: "trade",
      });
    }
  }

  const finalPlayers = state.players.map((p) => {
    if (p.id === playerId) return updatedSeller;
    if (p.id === target.id) return updatedTarget;
    return p;
  });

  const winner = determineWinner(finalPlayers);

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    pendingSell: null,
    winner,
    log: [...state.log, ...logs],
  };

  if (winner) {
    newState.log.push({
      turn: newState.turn,
      playerId: winner,
      message: `${finalPlayers.find((p) => p.id === winner)?.name ?? "?"}の勝利!`,
      kind: "system",
    });
  }

  void updatedSeller;

  return { ok: true, state: newState };
}

export function exchangeStats(
  state: GameState,
  playerId: PlayerId,
  mpDelta: number,
  moneyDelta: number,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) return { ok: false, reason: "not your turn" };
  if (state.winner) return { ok: false, reason: "game already finished" };
  if (state.phase === "defense") return { ok: false, reason: "defense pending" };
  if (state.pendingBuy) return { ok: false, reason: "buy pending" };
  if (state.pendingSell) return { ok: false, reason: "sell pending" };
  if (state.pendingExchange) return { ok: false, reason: "exchange pending" };
  if (!Number.isFinite(mpDelta) || !Number.isFinite(moneyDelta)) {
    return { ok: false, reason: "invalid delta" };
  }
  const roundedMp = Math.trunc(mpDelta);
  const roundedMoney = Math.trunc(moneyDelta);
  if (roundedMp === 0 && roundedMoney === 0) {
    return { ok: false, reason: "no change" };
  }

  const exchangeIdx = active.hand.findIndex((c) => c.id === "exchange");
  if (exchangeIdx === -1) return { ok: false, reason: "exchange card not in hand" };

  const newHp = active.hp - roundedMp - roundedMoney;
  const newMp = active.mp + roundedMp;
  const newMoney = active.money + roundedMoney;
  if (newHp < 0) return { ok: false, reason: "not enough HP" };
  if (newMp < 0) return { ok: false, reason: "not enough MP" };
  if (newMoney < 0) return { ok: false, reason: "not enough money" };

  const newHand = [...active.hand];
  newHand.splice(exchangeIdx, 1);

  const updatedActive: PlayerState = {
    ...active,
    hp: newHp,
    mp: newMp,
    money: newMoney,
    hand: newHand,
  };

  const finalPlayers = state.players.map((p) =>
    p.id === playerId ? updatedActive : p,
  );
  const winner = determineWinner(finalPlayers);

  const logs: BattleLogEntry[] = [];
  const parts: string[] = [];
  if (roundedMp !== 0) {
    parts.push(`MP${roundedMp >= 0 ? "+" : ""}${roundedMp}`);
  }
  if (roundedMoney !== 0) {
    parts.push(`￥${roundedMoney >= 0 ? "+" : ""}${roundedMoney}`);
  }
  parts.push(`HP${-(roundedMp + roundedMoney) >= 0 ? "+" : ""}${-(roundedMp + roundedMoney)}`);
  logs.push({
    turn: state.turn,
    playerId,
    message: `${active.name}が両替した (${parts.join(" / ")})`,
    kind: "trade",
  });

  const newState: GameState = {
    ...state,
    players: finalPlayers,
    pendingExchange: null,
    winner,
    log: [...state.log, ...logs],
  };

  if (winner) {
    newState.log.push({
      turn: newState.turn,
      playerId: winner,
      message: `${finalPlayers.find((p) => p.id === winner)?.name ?? "?"}の勝利!`,
      kind: "system",
    });
  }

  return { ok: true, state: newState };
}
