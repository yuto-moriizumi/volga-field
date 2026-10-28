import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "@volga/shared";
import {
  confirmBuy,
  createGame,
  defendAttack,
  discardCards,
  endTurn,
  exchangeStats,
  INITIAL_HAND_SIZE,
  MAX_HAND_SIZE,
  joinParty,
  playCard,
  sellCards,
  shuffleHand,
  startBuy,
} from "./battle.js";
import { BASE_CARDS, findCard } from "./cards.js";
import { drawRandomCards } from "./draw.js";

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
        party: null,
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
        hand: [{ id: "shield" }, { id: "leaf_shield" }, { id: "nobori" }],
        learnedMiracles: [],
        party: null,
        ready: true,
      },
    ],
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
        mp: 10,
        hand: [{ id: "heal" }],
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
  // 使った防御カード2枚ぶん引き直すので、残り1枚 + 2枚 = 3枚。
  assert.equal(defender?.hand.length, 3);
  assert.ok(defender?.hand.some((card) => card.id === "nobori"));
  assert.equal(result.state.phase, "play");
  assert.equal(result.state.pendingAttack, null);
  assert.equal(result.state.log.filter((entry) => entry.kind === "defense").length, 2);
});

test("playCard heals the player who uses the ヒール miracle", () => {
  const result = playCard(playState(), "attacker", { id: "heal" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.hp, 20);
  assert.equal(defender?.hp, 20);
});

test("playCard healing is not capped by maxHp", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    maxHp: 20,
    mp: 10,
    hand: [{ id: "heal" }],
  };

  const result = playCard(state, "attacker", { id: "heal" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.hp, 28);
  assert.equal(attacker?.maxHp, 20);
});

test("drawRandomCards draws the requested number of cards from BASE_CARDS", () => {
  const drawn = drawRandomCards(7);
  const baseIds = new Set(BASE_CARDS.map((card) => card.id));

  assert.equal(drawn.length, 7);
  for (const card of drawn) {
    assert.ok(baseIds.has(card.id), `unknown card id: ${card.id}`);
  }
});

test("drawRandomCards draws with replacement, so the same card can repeat", () => {
  // rng が常に同じ値を返すため、毎回同じカードが選ばれる。
  const drawn = drawRandomCards(5, () => 0);
  const ids = drawn.map((card) => card.id);

  assert.equal(drawn.length, 5);
  assert.equal(new Set(ids).size, 1);
  assert.equal(ids[0], BASE_CARDS[0]!.id);
});

test("drawRandomCards never depletes the candidate pool", () => {
  const first = drawRandomCards(30, () => 0.999);
  const second = drawRandomCards(30, () => 0.999);
  const lastId = BASE_CARDS[BASE_CARDS.length - 1]!.id;

  assert.ok(first.every((card) => card.id === lastId));
  assert.ok(second.every((card) => card.id === lastId));
});

test("drawRandomCards returns an empty array when asked for no cards", () => {
  let calls = 0;
  const rng = () => {
    calls += 1;
    return 0.5;
  };

  assert.deepEqual(drawRandomCards(0, rng), []);
  assert.equal(calls, 0);
});

test("createGame deals the initial hand from BASE_CARDS", () => {
  const { state } = createGame("room", [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ]);
  const baseIds = new Set(BASE_CARDS.map((card) => card.id));

  for (const player of state.players) {
    assert.equal(player.hand.length, INITIAL_HAND_SIZE);
    for (const card of player.hand) {
      assert.ok(baseIds.has(card.id), `unknown card id: ${card.id}`);
    }
  }
  assert.equal("deckSize" in state, false);
});

test("playing one card from the 9-card opening hand leaves 8 cards", () => {
  const { state } = createGame("room", [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ]);
  const openingHand = Array.from({ length: INITIAL_HAND_SIZE }, () => ({ id: "sword" }));
  state.players[0] = { ...state.players[0]!, hand: openingHand };

  const result = playCard(state, "p1", { id: "sword" }, "p2");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const player = result.state.players.find((p) => p.id === "p1");
  assert.equal(player?.hand.length, INITIAL_HAND_SIZE - 1);
  assert.ok(player!.hand.every((card) => card.id === "sword"));
});

function handOf(state: GameState, playerId: string): number {
  return state.players.find((p) => p.id === playerId)?.hand.length ?? 0;
}

test("endTurn draws one card after a turn with no cards used", () => {
  const { state } = createGame("room", [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ]);

  const result = endTurn(state, "p1", 0, () => 0);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(handOf(result.state, "p1"), INITIAL_HAND_SIZE + 1);
  assert.ok(result.state.log.some((entry) => entry.message.includes("1枚ドロー")));
});

test("endTurn draws as many cards as were used during the turn", () => {
  const { state } = createGame("room", [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ]);
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "sword" }, { id: "sword" }, { id: "sword" }],
  };

  const result = endTurn(state, "p1", 2, () => 0);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(handOf(result.state, "p1"), 5);
  assert.ok(result.state.log.some((entry) => entry.message.includes("2枚ドロー")));
});

test("endTurn does not draw beyond the 18-card hand limit", () => {
  const { state } = createGame("room", [
    { id: "p1", name: "A" },
    { id: "p2", name: "B" },
  ]);
  const fullHand = Array.from({ length: MAX_HAND_SIZE }, () => ({ id: "sword" }));
  state.players[0] = { ...state.players[0]!, hand: fullHand };

  const result = endTurn(state, "p1", 3, () => 0);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(handOf(result.state, "p1"), MAX_HAND_SIZE);
  assert.ok(!result.state.log.some((entry) => entry.message.includes("枚ドロー")));
});

test("defendAttack draws nothing when the defender passes", () => {
  const state = defenseState();
  const before = handOf(state, "defender");

  const result = defendAttack(state, "defender", []);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(handOf(result.state, "defender"), before);
});

test("defendAttack draws as many cards as the defender used", () => {
  const result = defendAttack(
    defenseState(),
    "defender",
    [{ id: "shield" }, { id: "leaf_shield" }],
    () => 0,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  // 3枚 - 2枚使用 + 2枚ドロー = 3枚
  assert.equal(handOf(result.state, "defender"), 3);
  assert.ok(result.state.log.some((entry) => entry.message.includes("2枚ドロー")));
});

test("defendAttack never pushes the hand beyond the 18-card limit", () => {
  const state = defenseState();
  state.players[1] = {
    ...state.players[1]!,
    hand: [
      ...Array.from({ length: MAX_HAND_SIZE - 1 }, () => ({ id: "sword" })),
      { id: "shield" },
    ],
  };

  const result = defendAttack(state, "defender", [{ id: "shield" }], () => 0);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  // 18枚から1枚使って17枚、1枚引いて18枚。上限は超えない。
  assert.equal(handOf(result.state, "defender"), MAX_HAND_SIZE);
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
    hand: [{ id: "nobori" }, { id: "tasuki" }, { id: "axe" }],
  };

  const result = discardCards(state, "attacker", [{ id: "nobori" }, { id: "axe" }]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.deepEqual(attacker?.hand, [{ id: "tasuki" }]);
  assert.equal(result.state.log.at(-1)?.kind, "system");
});

test("discardCards also discards trade cards", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "buy" }, { id: "sell" }, { id: "exchange" }, { id: "nobori" }],
  };

  const result = discardCards(state, "attacker", [
    { id: "buy" },
    { id: "sell" },
    { id: "exchange" },
  ]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.deepEqual(attacker?.hand, [{ id: "nobori" }]);
});

test("startBuy picks a random card from the target and consumes the buy card", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "buy" }, { id: "nobori" }],
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
  assert.deepEqual(attacker?.hand, [{ id: "nobori" }]);
  assert.equal(result.state.pendingBuy?.sourceId, "attacker");
  assert.equal(result.state.pendingBuy?.targetId, "defender");
  assert.equal(defender?.hand.length, 2);
});

test("confirmBuy moves the card and money when accepted", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "buy" }, { id: "nobori" }],
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
    hand: [{ id: "buy" }, { id: "nobori" }],
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
    hand: [{ id: "sell" }, { id: "nobori" }, { id: "axe" }],
    money: 0,
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [],
    money: 20,
  };

  const result = sellCards(state, "attacker", [{ id: "nobori" }, { id: "axe" }], "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.money, 8);
  assert.equal(defender?.money, 20 - 8);
  assert.equal(attacker?.hand.length, 0);
  assert.equal(defender?.hand.length, 2);
});

test("sellCards drains money, then MP, then HP when target cannot pay", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "sell" }, { id: "election_car" }],
    money: 0,
  };
  state.players[1] = {
    ...state.players[1]!,
    hand: [],
    money: 2,
    mp: 3,
    hp: 20,
  };

  const result = sellCards(state, "attacker", [{ id: "election_car" }], "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(defender?.money, 0);
  assert.equal(defender?.mp, 0);
  assert.equal(defender?.hp, 15);
  assert.ok(defender?.hand.some((c) => c.id === "election_car"));
});

test("exchangeStats converts HP into MP and money", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 0,
    money: 5,
    hand: [{ id: "exchange" }, { id: "nobori" }],
  };

  const result = exchangeStats(state, "attacker", 3, 7);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.hp, 10);
  assert.equal(attacker?.mp, 3);
  assert.equal(attacker?.money, 12);
  assert.deepEqual(attacker?.hand, [{ id: "nobori" }]);
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
    hand: [{ id: "nobori" }],
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
    hand: [{ id: "tasuki" }],
  };

  const result = playCard(state, "attacker", { id: "tasuki" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  const defender = result.state.players.find((p) => p.id === "defender");
  assert.equal(attacker?.mp, 4);
  assert.equal(defender?.mp, 0);
  const mpRecoverLog = result.state.log.find((entry) => entry.kind === "mpRecover");
  assert.ok(mpRecoverLog);
  assert.equal(mpRecoverLog?.message, "AttackerのMPが2回復 (タスキ)");
});

test("playCard caps MP recovery at the player's maxMp", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hp: 20,
    mp: 8,
    maxMp: 10,
    hand: [{ id: "election_car" }],
  };

  const result = playCard(state, "attacker", { id: "election_car" }, "defender");

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
    hand: [{ id: "nobori" }, { id: "tasuki" }],
  };

  const result = playCard(state, "attacker", { id: "nobori" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.mp, 1);
  assert.deepEqual(attacker?.hand, [{ id: "tasuki" }]);
});

test("misc cards are political campaign items that recover MP", () => {
  const politicalItems = [
    { id: "nobori", name: "のぼり", mpRecover: 1, price: 3 },
    { id: "tasuki", name: "タスキ", mpRecover: 2, price: 5 },
    { id: "poster", name: "ポスター", mpRecover: 3, price: 7 },
    { id: "election_car", name: "選挙カー", mpRecover: 5, price: 10 },
  ];

  const miscIds = BASE_CARDS.filter((card) => card.category === "misc").map(
    (card) => card.id,
  );
  assert.deepEqual(miscIds, politicalItems.map((item) => item.id));

  for (const expected of politicalItems) {
    const card = findCard(expected.id);
    assert.ok(card, `missing misc card: ${expected.id}`);
    assert.equal(card?.category, "misc");
    assert.equal(card?.name, expected.name);
    assert.equal(card?.price, expected.price);

    const mpRecover = card?.effects.find((effect) => effect.kind === "mpRecover");
    assert.equal(mpRecover?.target, "self");
    assert.equal(mpRecover?.amount, expected.mpRecover);
  }
});

function attributeWeaponState(): GameState {
  return {
    roomId: "room",
    players: [
      {
        id: "attacker",
        name: "Attacker",
        hp: 20,
        maxHp: 20,
        mp: 10,
        maxMp: 10,
        money: 20,
        hand: [
          { id: "socialist_strike_3" },
          { id: "socialist_power_2" },
          { id: "socialist_power_3" },
        ],
        learnedMiracles: [],
        party: null,
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
        hand: [],
        learnedMiracles: [],
        party: null,
        ready: true,
      },
    ],
    turn: 1,
    actionTurn: 1,
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
  };
}

test("playCard with a single attribute weapon deals its damage", () => {
  const result = playCard(
    attributeWeaponState(),
    "attacker",
    { id: "socialist_strike_3" },
    "defender",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pendingAttack?.amount, 3);
  assert.equal(result.state.pendingAttack?.cardName, "国有化攻勢");
  assert.equal(result.state.phase, "defense");
});

test("playCard combines multiple cards into a single attack", () => {
  const result = playCard(
    attributeWeaponState(),
    "attacker",
    [
      { id: "socialist_strike_3" },
      { id: "socialist_power_2" },
    ],
    "defender",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pendingAttack?.amount, 5);
  assert.equal(result.state.pendingAttack?.cardName, "国有化攻勢+計画経済");
  assert.equal(result.state.phase, "defense");
});

test("playCard combines multiple attack_power cards together", () => {
  const result = playCard(
    attributeWeaponState(),
    "attacker",
    [
      { id: "socialist_power_2" },
      { id: "socialist_power_3" },
    ],
    "defender",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pendingAttack?.amount, 5);
  assert.equal(result.state.pendingAttack?.cardName, "計画経済+労働動員");
});

test("removed special cards are absent from the card data", () => {
  for (const id of ["potion", "hi_potion", "poison", "sacrifice"]) {
    assert.equal(findCard(id), undefined, `${id} should be removed`);
  }

  const categories = new Set<string>(BASE_CARDS.map((card) => card.category));
  assert.deepEqual(
    [...categories].sort(),
    ["miracle", "misc", "party", "shield", "trade", "weapon"],
  );
  assert.equal(categories.has("special"), false);
});

test("former colorless diplomatic cards are weapons and combine with attack power cards", () => {
  assert.equal(findCard("concern_expressed")?.category, "weapon");
  assert.equal(findCard("condemn_strongest_terms")?.category, "weapon");

  const state = attributeWeaponState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "concern_expressed" }, { id: "socialist_power_1" }],
  };

  const result = playCard(
    state,
    "attacker",
    [{ id: "concern_expressed" }, { id: "socialist_power_1" }],
    "defender",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pendingAttack?.amount, 2);
  assert.equal(result.state.pendingAttack?.cardName, "懸念を表明する+団結");
});

test("playCard rejects combining two direct attack cards", () => {
  const state = attributeWeaponState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "sword" }, { id: "spear" }],
  };

  const result = playCard(
    state,
    "attacker",
    [{ id: "sword" }, { id: "spear" }],
    "defender",
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "only one attack card can be used per turn");
});

test("playCard allows one direct attack card with multiple attack power cards", () => {
  const result = playCard(
    attributeWeaponState(),
    "attacker",
    [
      { id: "socialist_strike_3" },
      { id: "socialist_power_2" },
      { id: "socialist_power_3" },
    ],
    "defender",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pendingAttack?.amount, 8);
  assert.equal(
    result.state.pendingAttack?.cardName,
    "国有化攻勢+計画経済+労働動員",
  );
});

test("playCard rejects when any selected card is missing from hand", () => {
  const state = attributeWeaponState();
  const result = playCard(state, "attacker", [
    { id: "socialist_strike_3" },
    { id: "socialist_strike_5" },
  ]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "card not in hand");
});

test("playCard removes all played cards from hand", () => {
  const result = playCard(
    attributeWeaponState(),
    "attacker",
    [
      { id: "socialist_strike_3" },
      { id: "socialist_power_2" },
    ],
    "defender",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.deepEqual(attacker?.hand, [{ id: "socialist_power_3" }]);
});

test("defendAttack reduces damage from combined multi-card attack", () => {
  const state = attributeWeaponState();
  state.players[1] = {
    ...state.players[1]!,
    hand: [{ id: "shield" }],
  };
  const play = playCard(
    state,
    "attacker",
    [
      { id: "socialist_strike_3" },
      { id: "socialist_power_2" },
    ],
    "defender",
  );
  assert.equal(play.ok, true);
  if (!play.ok) return;
  const defended = defendAttack(play.state, "defender", [{ id: "shield" }]);
  assert.equal(defended.ok, true);
  if (!defended.ok) return;
  const defender = defended.state.players.find((p) => p.id === "defender");
  assert.equal(defender?.hp, 18);
});

test("playCard joins the player's party when a party card is used", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    hand: [{ id: "communist_party" }, { id: "nobori" }],
  };

  const result = playCard(state, "attacker", { id: "communist_party" }, "defender");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.party, "communist_party");
  assert.deepEqual(attacker?.hand, [{ id: "nobori" }]);
  const joinLog = result.state.log.at(-1);
  assert.equal(joinLog?.kind, "special");
  assert.ok(joinLog?.message.includes("共産党"));
});

test("joinParty replaces the previous party affiliation", () => {
  const state = playState();
  state.players[0] = {
    ...state.players[0]!,
    party: "ldp",
    hand: [{ id: "anarchist_party" }],
  };

  const result = joinParty(state, "attacker", { id: "anarchist_party" });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const attacker = result.state.players.find((p) => p.id === "attacker");
  assert.equal(attacker?.party, "anarchist_party");
  assert.deepEqual(attacker?.hand, []);
  const joinLog = result.state.log.at(-1);
  assert.equal(joinLog?.kind, "special");
  assert.ok(joinLog?.message.includes("自民党"));
  assert.ok(joinLog?.message.includes("無政府党"));
});

test("shuffleHand replaces the whole hand with the same number of cards", () => {
  const { state } = createGame("room", [
    { id: "attacker", name: "Attacker" },
    { id: "defender", name: "Defender" },
  ]);
  const before = state.players[0]!;
  // 常に先頭のカードを引く rng。手札がすべて同じカードになれば引き直しが効いている。
  const result = shuffleHand(state, "attacker", () => 0);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const after = result.state.players.find((p) => p.id === "attacker")!;
  assert.equal(after.hand.length, before.hand.length);
  assert.ok(after.hand.every((card) => card.id === BASE_CARDS[0]!.id));
  // 手番は消費しない。
  assert.equal(result.state.activePlayerIndex, state.activePlayerIndex);
  assert.equal(result.state.turn, state.turn);
  assert.equal(result.state.actionTurn, state.actionTurn);
  assert.ok(result.state.log.at(-1)?.message.includes("引き直した"));
});

test("shuffleHand refuses an empty hand", () => {
  const state = playState();
  state.players[0] = { ...state.players[0]!, hand: [] };

  const result = shuffleHand(state, "attacker");

  assert.equal(result.ok, false);
});
