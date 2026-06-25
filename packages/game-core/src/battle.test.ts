import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "@volga/shared";
import {
  confirmBuy,
  defendAttack,
  discardCards,
  exchangeStats,
  playCard,
  sellCards,
  startBuy,
} from "./battle.js";

function defenseState(): GameState {
  return {
    roomId: "room",
    players: [
      {
        id: "attacker",
        name: "Attacker",
        hp: 20,
        maxHp: 20,
        mp: 0,
        maxMp: 10,
        money: 20,
        hand: [],
        learnedMiracles: [],
        ready: true,
      },
      {
        id: "defender",
        name: "Defender",
        hp: 20,
        maxHp: 20,
        mp: 0,
        maxMp: 10,
        money: 20,
        hand: [{ id: "shield" }, { id: "leaf_shield" }, { id: "potion" }],
        learnedMiracles: [],
        ready: true,
      },
    ],
    deckSize: 0,
    turn: 1,
    actionTurn: 1,
    doomsdayTurn: null,
    doomsdayActive: false,
    activePlayerIndex: 0,
    phase: "defense",
    pendingAttack: {
      attackerId: "attacker",
      defenderId: "defender",
      card: { id: "axe" },
      cardName: "斧",
      amount: 4,
    },
    pendingBuy: null,
    pendingSell: null,
    pendingExchange: null,
    log: [],
    winner: null,
    startedAt: 0,
  };
}

function playState(): GameState {
  const state = defenseState();
  return {
    ...state,
    phase: "play",
    pendingAttack: null,
    players: [
      {
        ...state.players[0]!,
        hp: 12,
        hand: [{ id: "potion" }],
      },
      {
        ...state.players[1]!,
        hp: 20,
        hand: [],
      },
    ],
  };
}

test("defendAttack can use multiple defense cards at once", () => {
  const result = defendAttack(defenseState(), "defender", [
    { id: "shield" },
    { id: "leaf_shield" },
  ]);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(defender?.hp, 20);
  assert.deepEqual(defender?.hand, [{ id: "potion" }]);
  assert.equal(result.state.phase, "play");
  assert.equal(result.state.pendingAttack, null);
  assert.equal(result.state.log.filter((entry) => entry.kind === "defense").length, 2);
});

test("playCard heals the player who uses a healing potion", () => {
  const result = playCard(playState(), "attacker", { id: "potion" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.hp, 17);
  assert.equal(defender?.hp, 20);
});

test("playCard rejects defense cards on the attacker's turn", () => {
  const state = defenseState();
  state.phase = "play";
  state.pendingAttack = null;
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "shield" }],
  };

  const result = playCard(state, "attacker", { id: "shield" });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "defense card can only be used while defending");
});

test("discardCards removes selected cards during the active player's turn", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "potion" }, { id: "potion" }, { id: "axe" }],
  };

  const result = discardCards(state, "attacker", [{ id: "potion" }, { id: "axe" }]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.deepEqual(attacker?.hand, [{ id: "potion" }]);
  assert.equal(result.state.log.at(-1)?.kind, "system");
});

test("startBuy picks a random card from the target and consumes the buy card", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "buy" }, { id: "potion" }],
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [{ id: "axe" }, { id: "shield" }],
  };

  const result = startBuy(state, "attacker", "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.deepEqual(attacker?.hand, [{ id: "potion" }]);
  assert.equal(result.state.pendingBuy?.sourceId, "attacker");
  assert.equal(result.state.pendingBuy?.targetId, "defender");
  assert.equal(defender?.hand.length, 2);
});

test("confirmBuy moves the card and money when accepted", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "buy" }, { id: "potion" }],
    money: 20,
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [{ id: "axe" }],
    money: 20,
  };

  const started = startBuy(state, "attacker", "defender");
  assert.equal(started.ok, true);
  if (!started.ok) return;
  const price = started.state.pendingBuy?.price ?? 0;
  assert.ok(price > 0);

  const confirmed = confirmBuy(started.state, "attacker", true);
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  const attacker = confirmed.state.players.find((p) => p.id === "attacker");
  const defender = confirmed.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.money, 20 - price);
  assert.equal(defender?.money, 20 + price);
  assert.equal(confirmed.state.pendingBuy, null);
  assert.ok(attacker?.hand.some((c) => c.id === "axe"));
});

test("confirmBuy cancels when buyer declines", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "buy" }, { id: "potion" }],
    money: 20,
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [{ id: "axe" }],
    money: 20,
  };

  const started = startBuy(state, "attacker", "defender");
  assert.equal(started.ok, true);
  if (!started.ok) return;

  const declined = confirmBuy(started.state, "attacker", false);
  assert.equal(declined.ok, true);
  if (!declined.ok) return;
  const attacker = declined.state.players.find((p) => p.id === "attacker");
  const defender = declined.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.money, 20);
  assert.equal(defender?.money, 20);
  assert.deepEqual(defender?.hand, [{ id: "axe" }]);
  assert.equal(declined.state.pendingBuy, null);
});

test("sellCards transfers selected cards and money to the target", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "sell" }, { id: "potion" }, { id: "axe" }],
    money: 0,
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [],
    money: 20,
  };

  const result = sellCards(state, "attacker", [{ id: "potion" }, { id: "axe" }], "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.money, 9);
  assert.equal(defender?.money, 20 - 9);
  assert.equal(attacker?.hand.length, 0);
  assert.equal(defender?.hand.length, 2);
});

test("sellCards drains money, then MP, then HP when target cannot pay", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "sell" }, { id: "hi_potion" }],
    money: 0,
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [],
    money: 2,
    mp: 3,
    hp: 20,
  };

  const result = sellCards(state, "attacker", [{ id: "hi_potion" }], "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(defender?.money, 0);
  assert.equal(defender?.mp, 0);
  assert.equal(defender?.hp, 17);
  assert.ok(defender?.hand.some((c) => c.id === "hi_potion"));
});

test("exchangeStats converts HP into MP and money", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 0,
    money: 5,
    hand: [{ id: "exchange" }, { id: "potion" }],
  };

  const result = exchangeStats(state, "attacker", 3, 7);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.hp, 10);
  assert.equal(attacker?.mp, 3);
  assert.equal(attacker?.money, 12);
  assert.deepEqual(attacker?.hand, [{ id: "potion" }]);
  assert.equal(result.state.log.at(-1)?.kind, "trade");
});

test("exchangeStats rejects when HP would go negative", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 5,
    mp: 0,
    money: 0,
    hand: [{ id: "exchange" }],
  };

  const result = exchangeStats(state, "attacker", 3, 3);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not enough HP");
  const attacker = state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.hp, 5);
  assert.equal(attacker?.hand.length, 1);
});

test("exchangeStats rejects when MP would go negative", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 2,
    money: 0,
    hand: [{ id: "exchange" }],
  };

  const result = exchangeStats(state, "attacker", -3, 0);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not enough MP");
});

test("exchangeStats rejects when money would go negative", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 0,
    money: 2,
    hand: [{ id: "exchange" }],
  };

  const result = exchangeStats(state, "attacker", 0, -3);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not enough money");
});

test("exchangeStats rejects when exchange card is not in hand", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 0,
    money: 0,
    hand: [{ id: "potion" }],
  };

  const result = exchangeStats(state, "attacker", 1, 0);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "exchange card not in hand");
});

test("exchangeStats rejects when no changes are requested", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 0,
    money: 0,
    hand: [{ id: "exchange" }],
  };

  const result = exchangeStats(state, "attacker", 0, 0);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "no change");
});

test("playCard recovers MP when the player uses a misc MP-recovery card", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 2,
    hand: [{ id: "supporter_rally" }],
  };

  const result = playCard(state, "attacker", { id: "supporter_rally" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.mp, 4);
  assert.equal(defender?.mp, 0);
  const mpRecoverLog = result.state.log.find((entry) => entry.kind === "mpRecover");
  assert.ok(mpRecoverLog);
  assert.equal(mpRecoverLog?.message, "AttackerのMPが2回復 (支持者集会)");
});

test("playCard caps MP recovery at the player's maxMp", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 8,
    maxMp: 10,
    hand: [{ id: "un_speech" }],
  };

  const result = playCard(state, "attacker", { id: "un_speech" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.mp, 10);
});

test("playCard consumes the misc card from hand after use", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 0,
    hand: [{ id: "local_campaign" }, { id: "potion" }],
  };

  const result = playCard(state, "attacker", { id: "local_campaign" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.mp, 1);
  assert.deepEqual(attacker?.hand, [{ id: "potion" }]);
});
