import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "@volga/shared";
import { defendAttack, playCard } from "./battle.js";

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
