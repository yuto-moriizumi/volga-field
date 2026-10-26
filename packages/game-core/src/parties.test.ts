import assert from "node:assert/strict";
import test from "node:test";
import type { GameState, PartyId, PlayerState } from "@volga/shared";
import { endTurn } from "./battle.js";
import { PARTY_ACTION_CHANCE, resolvePartyActions } from "./parties.js";

const FULL_HAND = Array.from({ length: 5 }, () => ({ id: "sword" }));

function player(id: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id,
    hp: 20,
    maxHp: 20,
    mp: 10,
    maxMp: 10,
    money: 20,
    hand: FULL_HAND.map((card) => ({ ...card })),
    learnedMiracles: [],
    party: null,
    ready: true,
    ...overrides,
  };
}

function gameState(players: PlayerState[], activePlayerIndex = 0): GameState {
  return {
    roomId: "room",
    players,
    deckSize: 0,
    turn: 1,
    actionTurn: 1,
    doomsdayTurn: null,
    doomsdayActive: false,
    activePlayerIndex,
    phase: "play",
    pendingAttack: null,
    pendingBuy: null,
    pendingSell: null,
    pendingExchange: null,
    log: [],
    winner: null,
    startedAt: 0,
  };
}

/** 値を順番に返す決定的な RNG。想定より多く呼ばれた場合はテストを失敗させる。 */
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) throw new Error("rng sequence exhausted");
    return value;
  };
}

function withParty(id: string, party: PartyId, overrides: Partial<PlayerState> = {}) {
  return player(id, { party, ...overrides });
}

test("party actions use a 25% trigger chance", () => {
  assert.equal(PARTY_ACTION_CHANCE, 0.25);
});

test("a failed 25% roll produces no action or log", () => {
  const state = gameState([withParty("voter", "communist_party"), player("other")]);

  const result = resolvePartyActions(state, "other", [], sequenceRng([0.9]));

  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.state.players, state.players);
  assert.equal(result.state.log.length, state.log.length);
});

test("communist party deals damage to a random living opponent", () => {
  const state = gameState([withParty("voter", "communist_party"), player("other")]);

  // chance 0.1 -> success, action 0.1 -> 労働者の反撃 (60/100), target 0.0 -> other
  const result = resolvePartyActions(state, "other", [], sequenceRng([0.1, 0.1, 0.0]));

  const other = result.state.players.find((p) => p.id === "other");
  assert.equal(other?.hp, 17);
  assert.equal(result.logs.length, 1);
  const log = result.logs[0]!;
  assert.equal(log.kind, "special");
  assert.equal(log.damage, 3);
  assert.ok(log.message.includes("共産党が動いた！"));
  assert.ok(log.message.includes("労働者の反撃"));
  assert.ok(log.message.includes("otherに3ダメージ"));
  assert.deepEqual(result.state.log, result.logs);
});

test("democratic party heals itself beyond the base HP", () => {
  const state = gameState([
    withParty("voter", "democratic_party", { hp: 20, maxHp: 20 }),
    player("other"),
  ]);

  // chance 0.1 -> success, action 0.9 -> 政策協力 (heal 2)
  const result = resolvePartyActions(state, "other", [], sequenceRng([0.1, 0.9]));

  const voter = result.state.players.find((p) => p.id === "voter");
  assert.equal(voter?.hp, 22);
  assert.equal(voter?.maxHp, 20);
  assert.ok(result.logs[0]?.message.includes("政策協力"));
});

test("democratic party recovers MP and caps at maxMp", () => {
  const state = gameState([
    withParty("voter", "democratic_party", { mp: 5, maxMp: 10 }),
    player("other"),
  ]);

  // chance 0.1 -> success, action 0.1 -> 世論の追い風 (MP+2)
  const result = resolvePartyActions(state, "other", [], sequenceRng([0.1, 0.1]));
  assert.equal(result.state.players.find((p) => p.id === "voter")?.mp, 7);

  const capped = gameState([
    withParty("voter", "green_party", { mp: 9, maxMp: 10 }),
    player("other"),
  ]);
  // chance 0.1 -> success, action 0.9 -> 再生エネルギー (MP+2, capped by maxMp)
  const cappedResult = resolvePartyActions(
    capped,
    "other",
    [],
    sequenceRng([0.1, 0.9]),
  );
  assert.equal(cappedResult.state.players.find((p) => p.id === "voter")?.mp, 10);
  assert.ok(cappedResult.logs[0]?.message.includes("MPが1回復"));
});

test("ldp gains money", () => {
  const state = gameState([
    withParty("voter", "ldp", { money: 20 }),
    player("other"),
  ]);

  // chance 0.1 -> success, action 0.1 -> 経済成長 (money +3)
  const result = resolvePartyActions(state, "other", [], sequenceRng([0.1, 0.1]));

  assert.equal(result.state.players.find((p) => p.id === "voter")?.money, 23);
  assert.ok(result.logs[0]?.message.includes("経済成長"));
});

test("anarchist party steals money from an opponent who has money", () => {
  const state = gameState([
    withParty("voter", "anarchist_party", { money: 20 }),
    player("other", { money: 5 }),
  ]);

  // chance 0.1 -> success, action 0.9 -> 略奪 (45%), target 0.0 -> other
  const result = resolvePartyActions(state, "other", [], sequenceRng([0.1, 0.9, 0.0]));

  assert.equal(result.state.players.find((p) => p.id === "voter")?.money, 22);
  assert.equal(result.state.players.find((p) => p.id === "other")?.money, 3);
  assert.ok(result.logs[0]?.message.includes("略奪"));
  assert.ok(result.logs[0]?.message.includes("2円を奪った"));
});

test("steal is skipped when no opponent has money", () => {
  const state = gameState([
    withParty("voter", "anarchist_party", { money: 20 }),
    player("other", { money: 0 }),
  ]);

  // chance 0.1 -> success, action 0.9 -> 略奪, but there is no valid target.
  const result = resolvePartyActions(state, "other", [], sequenceRng([0.1, 0.9]));

  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.state.players, state.players);
});

test("players without a party never act", () => {
  const state = gameState([player("voter"), player("other")]);

  const result = resolvePartyActions(state, "other", [], sequenceRng([]));

  assert.deepEqual(result.logs, []);
});

test("the player whose turn ended does not roll their own party", () => {
  const state = gameState([withParty("ender", "communist_party"), player("other")]);

  const result = resolvePartyActions(state, "ender", [], sequenceRng([]));

  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.state.players, state.players);
});

test("a dead party owner does not act", () => {
  const state = gameState([
    player("ender"),
    withParty("dead", "communist_party", { hp: 0 }),
    player("other"),
  ]);

  const result = resolvePartyActions(state, "ender", [], sequenceRng([]));

  assert.deepEqual(result.logs, []);
});

test("endTurn advances to the next living player when party damage kills the active player", () => {
  const state = gameState([
    player("ender"),
    player("active", { hp: 3 }),
    withParty("voter", "communist_party"),
  ]);
  const deck = [{ id: "sword" }];

  // chance 0.1 -> success, action 0.1 -> 労働者の反撃, target 0.9 -> active (index 1 of 2)
  const result = endTurn(state, "ender", deck, sequenceRng([0.1, 0.1, 0.9]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.players.find((p) => p.id === "active")?.hp, 0);
  assert.equal(result.state.activePlayerIndex, 2);
  assert.equal(result.state.winner, null);
  assert.ok(result.state.log.some((entry) => entry.message.includes("activeは倒れ")));
  assert.deepEqual(result.deck, deck);
});

test("endTurn sets the winner when party damage leaves only one player alive", () => {
  const state = gameState([
    player("ender", { hp: 3 }),
    withParty("voter", "communist_party"),
  ]);
  const deck: { id: string }[] = [];

  // chance 0.1 -> success, action 0.1 -> 労働者の反撃, target 0.0 -> ender
  const result = endTurn(state, "ender", deck, sequenceRng([0.1, 0.1, 0.0]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.players.find((p) => p.id === "ender")?.hp, 0);
  assert.equal(result.state.winner, "voter");
  assert.equal(result.state.log.at(-1)?.message, "voterの勝利!");
  assert.equal(result.state.log.at(-1)?.kind, "system");
});

test("party actions are not resolved when the game is already won", () => {
  const state = gameState([
    withParty("voter", "communist_party"),
    player("ender"),
  ]);
  state.winner = "voter";

  const result = resolvePartyActions(state, "ender", [], sequenceRng([]));

  assert.deepEqual(result.logs, []);
  assert.equal(result.state, state);
});
