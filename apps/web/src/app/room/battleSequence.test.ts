import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CARDS } from "@volga/game-core";
import type { GameState, PlayerState } from "@volga/shared";
import { deriveBattleEvents } from "./[roomId]/battleEvents";
import {
  buildDuelPresentation,
  defenseCardsFromLog,
  planDelta,
  planDuels,
  updateDuelModel,
  type DuelModel,
} from "./[roomId]/battleSequence";

const SHIELD = BASE_CARDS.find((card) => card.category === "shield")!;

function player(
  id: string,
  name: string,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    name,
    hp: 30,
    maxHp: 30,
    mp: 5,
    maxMp: 5,
    money: 10,
    hand: [],
    learnedMiracles: [],
    party: null,
    ready: true,
    ...overrides,
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: "room",
    players: [player("p1", "アリス"), player("p2", "ボブ")],
    deckSize: 20,
    turn: 3,
    actionTurn: 3,
    doomsdayTurn: null,
    doomsdayActive: false,
    activePlayerIndex: 0,
    phase: "play",
    pendingAttack: null,
    pendingBuy: null,
    pendingSell: null,
    pendingExchange: null,
    log: [],
    winner: null,
    startedAt: 0,
    ...overrides,
  };
}

const ATTACK_LOG = {
  turn: 3,
  playerId: "p1",
  message: "アリスが攻撃で攻撃",
  kind: "attack" as const,
};

function pendingAttackState(): GameState {
  return state({
    phase: "defense",
    pendingAttack: {
      attackerId: "p1",
      defenderId: "p2",
      card: { id: "attack" },
      cardName: "攻撃",
      amount: 5,
    },
    log: [ATTACK_LOG],
  });
}

const DAMAGE_LOG = {
  turn: 3,
  playerId: "p1",
  message: "ボブが3ダメージを受けた (攻撃)",
  kind: "attack" as const,
  damage: 3,
};

const DEFENSE_LOG = {
  turn: 3,
  playerId: "p2",
  message: `ボブが${SHIELD.name}で防御`,
  kind: "defense" as const,
};

function resolvedState(overrides: Partial<GameState> = {}): GameState {
  return state({
    players: [player("p1", "アリス"), player("p2", "ボブ", { hp: 27 })],
    log: [ATTACK_LOG, DEFENSE_LOG, DAMAGE_LOG],
    ...overrides,
  });
}

function startDuel(): { previous: GameState; next: GameState; model: DuelModel } {
  const previous = state();
  const next = pendingAttackState();
  const events = deriveBattleEvents(previous, next, "p1");
  const batch = planDuels(previous, next, "p1", events, 1);
  const model = batch.duels[0];
  assert.ok(model);
  return { previous, next, model };
}

test("defense log entries map to card ids", () => {
  const cards = defenseCardsFromLog([DEFENSE_LOG]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.name, SHIELD.name);
  assert.equal(cards[0]?.id, SHIELD.id);
});

test("pending attack opens a duel with the attack card and frozen stats", () => {
  const { model } = startDuel();
  assert.equal(model.attackerName, "アリス");
  assert.equal(model.defenderName, "ボブ");
  assert.equal(model.attackAmount, 5);
  assert.equal(model.effect, null);
  assert.equal(model.defenseCards, null);
  assert.equal(model.turn, null);
  assert.equal(model.statsBefore.p2?.hp, 30);
});

test("resolution fills the effect and the defense card, turn unchanged", () => {
  const { next: pending, model } = startDuel();
  const next = resolvedState();
  const events = deriveBattleEvents(pending, next, "p1");
  const update = updateDuelModel(model, pending, next, "p1", events);

  assert.equal(update.model.effect?.amount, 3);
  assert.equal(update.model.effect?.defensePower, 2);
  assert.equal(update.model.effect?.blocked, false);
  assert.deepEqual(update.model.defenseCards, [
    { id: SHIELD.id, name: SHIELD.name },
  ]);
  assert.equal(update.model.turn, null);
});

test("turn change in the same state as the resolution is picked up", () => {
  const { next: pending, model } = startDuel();
  // attack-ends-turn: the defense resolution also advances the active player.
  const next = resolvedState({ activePlayerIndex: 1, actionTurn: 4 });
  const events = deriveBattleEvents(pending, next, "p1");
  const update = updateDuelModel(model, pending, next, "p1", events);

  assert.equal(update.model.turn?.playerId, "p2");
  assert.equal(update.model.turn?.isSelf, false);
});

test("turn change arriving as a separate state after the resolution is picked up", () => {
  const { next: pending, model } = startDuel();
  const resolved = resolvedState();
  const resolvedEvents = deriveBattleEvents(pending, resolved, "p1");
  const first = updateDuelModel(model, pending, resolved, "p1", resolvedEvents);
  assert.equal(first.model.turn, null);

  const ended = resolvedState({ activePlayerIndex: 1, actionTurn: 4 });
  const endedEvents = deriveBattleEvents(resolved, ended, "p1");
  const second = updateDuelModel(
    first.model,
    resolved,
    ended,
    "p1",
    endedEvents,
  );
  assert.equal(second.model.turn?.playerId, "p2");
  assert.equal(second.model.turn?.continuation, false);
});

test("no turn event is derived when the attacker keeps the turn", () => {
  const { next: pending, model } = startDuel();
  const resolved = resolvedState();
  const events = deriveBattleEvents(pending, resolved, "p1");
  const update = updateDuelModel(model, pending, resolved, "p1", events);
  const ended = resolvedState({ activePlayerIndex: 0, actionTurn: 3 });
  const later = deriveBattleEvents(resolved, ended, "p1");
  const after = updateDuelModel(
    update.model,
    resolved,
    ended,
    "p1",
    later,
  );
  assert.equal(after.model.turn, null);
});

test("coalesced attack + resolution (AI defended in the same tick) still becomes one duel", () => {
  const previous = state();
  const next = resolvedState();
  const events = deriveBattleEvents(previous, next, "p1");
  assert.equal(events.filter((event) => event.kind === "attack").length, 1);
  const batch = planDuels(previous, next, "p1", events, 7);
  assert.equal(batch.duels.length, 1);
  const model = batch.duels[0]!;
  assert.equal(model.effect?.amount, 3);
  assert.deepEqual(model.defenseCards, [
    { id: SHIELD.id, name: SHIELD.name },
  ]);
  // The damage event is consumed by the duel and must not become an overlay.
  assert.ok(batch.consumed.some((event) => event.kind === "damage"));
});

test("presentation shows each step only from its stage and unfreezes stats at the effect", () => {
  const { model } = startDuel();
  const clear = buildDuelPresentation(model, "clear", false, "p2");
  assert.equal(clear.showAttackCard, false);
  assert.equal(clear.showTargetName, false);
  assert.equal(clear.isSelfDefender, true);

  const target = buildDuelPresentation(model, "target", true, "p2");
  assert.equal(target.showAttackCard, true);
  assert.equal(target.showTargetName, true);
  assert.equal(target.showDefense, false);
  assert.equal(target.awaitingDefense, true);
  assert.equal(target.statsBefore?.p2?.hp, 30);

  const defenseClear = buildDuelPresentation(model, "defenseClear", false, "p2");
  assert.equal(defenseClear.showDefense, false);

  const effect = buildDuelPresentation(model, "effect", false, "p2");
  assert.equal(effect.showDefense, true);
  assert.equal(effect.showEffect, true);
  assert.equal(effect.statsBefore, null);

  const turn = buildDuelPresentation(model, "turn", false, "p2");
  assert.equal(turn.showTurn, true);
  assert.equal(turn.showEffect, false);
  assert.equal(turn.showDefense, false);
  assert.equal(turn.showAttackCard, true);
});

test("coalesced fully blocked defense still becomes a duel", () => {
  const previous = state();
  const next = state({ log: [ATTACK_LOG, DEFENSE_LOG] });
  const events = deriveBattleEvents(previous, next, "p1");
  assert.ok(events.some((event) => event.kind === "attack"));
  const batch = planDuels(previous, next, "p1", events, 9);
  const model = batch.duels[0]!;
  assert.equal(model.effect?.amount, 0);
  assert.equal(model.effect?.blocked, true);
  assert.equal(model.defenseCards?.length, 1);
});

test("attack-card self-damage is folded into the duel, not shown as an overlay", () => {
  const previous = state();
  const recoilLog = {
    turn: 3,
    playerId: "p1",
    message: "アリスが1ダメージを受けた (サンダー)",
    kind: "attack" as const,
    damage: 1,
  };
  const pending = state({
    phase: "defense",
    players: [player("p1", "アリス", { hp: 29 }), player("p2", "ボブ")],
    pendingAttack: {
      attackerId: "p1",
      defenderId: "p2",
      card: { id: "attack" },
      cardName: "サンダー",
      amount: 3,
    },
    log: [ATTACK_LOG, recoilLog],
  });
  const events = deriveBattleEvents(previous, pending, "p1");
  const batch = planDuels(previous, pending, "p1", events, 5);
  const model = batch.duels[0]!;
  assert.equal(model.recoil, 1);
  assert.ok(
    batch.consumed.some(
      (event) =>
        event.kind === "damage" && event.selfDamage && event.playerId === "p1",
    ),
  );
});

test("a resolved attack and the AI counterattack in one delta become two duels", () => {
  const previous = state();
  const next = state({
    players: [player("p1", "アリス"), player("p2", "ボブ", { hp: 27 })],
    phase: "defense",
    pendingAttack: {
      attackerId: "p2",
      defenderId: "p1",
      card: { id: "attack" },
      cardName: "反撃",
      amount: 4,
    },
    log: [
      ATTACK_LOG,
      DEFENSE_LOG,
      DAMAGE_LOG,
      {
        turn: 3,
        playerId: "p2",
        message: "ボブが1枚ドロー",
        kind: "system" as const,
      },
      {
        turn: 3,
        playerId: "p2",
        message: "ボブが反撃で攻撃",
        kind: "attack" as const,
      },
    ],
  });
  const batch = planDuels(previous, next, "p1", [], 10);
  assert.equal(batch.duels.length, 2);
  const [first, second] = batch.duels;
  assert.equal(first?.attackerId, "p1");
  assert.equal(first?.defenderId, "p2");
  assert.equal(first?.effect?.amount, 3);
  assert.equal(first?.turn?.playerId, "p2");
  assert.equal(first?.drawCount, 1);
  // The AI's frozen view already includes my damage until its own effect.
  assert.equal(first?.statsBefore.p2?.hp, 30);
  assert.equal(second?.attackerId, "p2");
  assert.equal(second?.defenderId, "p1");
  assert.equal(second?.effect, null);
  assert.equal(second?.turn, null);
  assert.equal(second?.statsBefore.p2?.hp, 27);
});

const TRADE_LOG = {
  turn: 3,
  playerId: "p1",
  message: "アリスが両替した (MP+2 / ￥+1 / HP-3)",
  kind: "trade" as const,
};

const DRAW_LOG = {
  turn: 3,
  playerId: "p1",
  message: "アリスが1枚ドロー",
  kind: "system" as const,
};

const COUNTER_LOG = {
  turn: 3,
  playerId: "p2",
  message: "ボブが反撃で攻撃",
  kind: "attack" as const,
};

/**
 * The exchange, the turn end and the AI's attack delivered before the client
 * rendered once: the three server broadcasts collapse into a single delta.
 */
function coalescedExchangeState(): GameState {
  return state({
    players: [
      player("p1", "アリス", { hp: 27, mp: 7, money: 11 }),
      player("p2", "ボブ"),
    ],
    activePlayerIndex: 1,
    actionTurn: 4,
    phase: "defense",
    pendingAttack: {
      attackerId: "p2",
      defenderId: "p1",
      card: { id: "attack" },
      cardName: "反撃",
      amount: 2,
    },
    log: [TRADE_LOG, DRAW_LOG, COUNTER_LOG],
  });
}

test("exchange effects in a coalesced delta are ordered before the enemy duel", () => {
  const previous = state();
  const next = coalescedExchangeState();
  const events = deriveBattleEvents(previous, next, "p1");

  // The exchange happened before the attack declaration, so its effects are
  // derived in front of the attack (instead of being appended after it).
  assert.deepEqual(
    events.map((event) => event.kind),
    ["mpRecover", "money", "attack", "turn"],
  );
  const mp = events[0];
  assert.equal(mp?.kind === "mpRecover" ? mp.amount : null, 2);
  const money = events[1];
  assert.equal(money?.kind === "money" ? money.delta : null, 1);

  const plan = planDelta(previous, next, "p1", events, 1);
  assert.deepEqual(
    plan.leading.map((event) => event.kind),
    ["mpRecover", "money"],
  );
  assert.equal(plan.duels.length, 1);
  assert.equal(plan.duels[0]?.attackerId, "p2");
  assert.equal(plan.duels[0]?.defenderId, "p1");

  // What `consumeDelta` pushes into the queue: leading overlays first, then
  // the duel, then whatever is left.
  const queue = [
    ...plan.leading.map((event) => `overlay:${event.kind}`),
    ...plan.duels.map((duel) => `duel:${duel.attackerId}`),
    ...plan.events.map((event) => `overlay:${event.kind}`),
  ];
  assert.deepEqual(queue, ["overlay:mpRecover", "overlay:money", "duel:p2"]);
});

test("support logged after the attack declaration stays behind the duel", () => {
  const healLog = {
    turn: 3,
    playerId: "p2",
    message: "ボブが3回復 (回復)",
    kind: "heal" as const,
  };
  const previous = state({
    players: [player("p1", "アリス"), player("p2", "ボブ", { hp: 27 })],
  });
  const next = state({
    players: [player("p1", "アリス"), player("p2", "ボブ")],
    phase: "defense",
    pendingAttack: {
      attackerId: "p2",
      defenderId: "p1",
      card: { id: "attack" },
      cardName: "反撃",
      amount: 3,
    },
    log: [COUNTER_LOG, healLog],
  });

  const events = deriveBattleEvents(previous, next, "p1");
  const plan = planDelta(previous, next, "p1", events, 1);
  assert.deepEqual(plan.leading, []);
  assert.equal(plan.duels.length, 1);
  assert.deepEqual(
    plan.events.map((event) => event.kind),
    ["heal"],
  );
});

test("a trade-only delta yields the exchange's MP and money events", () => {
  const previous = state();
  const next = state({
    players: [
      player("p1", "アリス", { hp: 27, mp: 7, money: 11 }),
      player("p2", "ボブ"),
    ],
    log: [TRADE_LOG],
  });
  const events = deriveBattleEvents(previous, next, "p1");
  assert.deepEqual(
    events.map((event) => event.kind),
    ["mpRecover", "money"],
  );
});
