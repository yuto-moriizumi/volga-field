import assert from "node:assert/strict";
import test from "node:test";
import type { GameState, PlayerState } from "@volga/shared";
import { endTurn } from "./battle.js";
import {
  DOOMSDAY_DEVILS,
  DOOMSDAY_DEVIL_RATE,
  applyDoomsdayDevil,
  pickDoomsdayDevil,
  rollDoomsdayDevil,
} from "./devils.js";

const FULL_HAND = Array.from({ length: 5 }, () => ({ id: "sword" }));

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: "victim",
    name: "被害者",
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

function gameState(players: PlayerState[], overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: "room",
    players,
    turn: 7,
    actionTurn: 7,
    doomsdayTurn: 50,
    doomsdayActive: true,
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

function devil(id: string) {
  const found = DOOMSDAY_DEVILS.find((entry) => entry.id === id);
  assert.ok(found, `devil ${id} should exist`);
  return found;
}

test("doomsday devils use a 25% appearance rate", () => {
  assert.equal(DOOMSDAY_DEVIL_RATE, 0.25);
});

test("a failed 25% roll produces no devil and leaves the player unchanged", () => {
  const rolled = rollDoomsdayDevil(() => 0.25);
  assert.equal(rolled, null);

  // 手札1枚不足。0.25 は失敗なので悪魔は現れない（0.0 はドローの抽選）。
  const result = endTurn(
    gameState([
      player({ hand: FULL_HAND.slice(0, 4).map((card) => ({ ...card })) }),
      player({ id: "other", name: "相手" }),
    ]),
    "victim",
    1,
    sequenceRng([0.25, 0.0]),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const updated = result.state.players.find((entry) => entry.id === "victim");
  assert.equal(updated?.hp, 20);
  assert.equal(updated?.hand.length, 5);
  assert.ok(!result.state.log.some((entry) => entry.message.includes("終末の時:")));
});

test("each devil applies its effect and logs the name, action and result", () => {
  const cases = [
    { id: "trump", hp: 10, hand: 5, action: "ツイート砲", effect: "10ダメージ" },
    { id: "putin", hp: 0, hand: 5, action: "特別軍事作戦", effect: "20ダメージ" },
    { id: "kim_jong_un", hp: 0, hand: 5, action: "ミサイル発射", effect: "30ダメージ" },
    { id: "elon_musk", hp: 20, hand: 3, action: "アカウント凍結", effect: "神器を2枚捨てた" },
    { id: "boj_governor", hp: 30, hand: 5, action: "金融緩和", effect: "HPが10回復した" },
  ];

  for (const expected of cases) {
    const entry = devil(expected.id);
    const result = applyDoomsdayDevil(entry, player(), 7);

    assert.equal(result.player.hp, expected.hp, `${expected.id} hp`);
    assert.equal(result.player.hand.length, expected.hand, `${expected.id} hand`);
    assert.equal(result.log.turn, 7);
    assert.equal(result.log.playerId, "victim");
    assert.equal(result.log.kind, "system");
    assert.ok(result.log.message.includes(entry.name), `${expected.id} name`);
    assert.ok(result.log.message.includes(expected.action), `${expected.id} action`);
    assert.ok(result.log.message.includes(expected.effect), `${expected.id} effect`);
    assert.ok(result.log.message.includes(entry.emoji), `${expected.id} emoji`);
  }
});

test("damage devils report their damage on the log entry", () => {
  for (const [id, damage] of [
    ["trump", 10],
    ["putin", 20],
    ["kim_jong_un", 30],
  ] as const) {
    const result = applyDoomsdayDevil(devil(id), player({ hp: 40 }), 1);
    assert.equal(result.log.damage, damage);
    assert.equal(result.player.hp, 40 - damage);
  }
});

test("weighted picker respects the cumulative weight boundaries", () => {
  const boundaries: [number, string][] = [
    [0, "trump"],
    [0.2799, "trump"],
    [0.28, "putin"],
    [0.4799, "putin"],
    [0.48, "kim_jong_un"],
    [0.5999, "kim_jong_un"],
    [0.6, "elon_musk"],
    [0.7999, "elon_musk"],
    [0.8, "boj_governor"],
    [0.9999, "boj_governor"],
  ];

  for (const [roll, expected] of boundaries) {
    assert.equal(pickDoomsdayDevil(() => roll).id, expected, `roll ${roll}`);
  }
});

test("twenty-five total weight maps every slice to one draw", () => {
  assert.equal(
    DOOMSDAY_DEVILS.reduce((sum, entry) => sum + entry.weight, 0),
    25,
  );
});

test("heal has no HP cap and can raise HP above 20", () => {
  const result = applyDoomsdayDevil(devil("boj_governor"), player({ hp: 20 }), 1);
  assert.equal(result.player.hp, 30);
  assert.equal(result.player.maxHp, 20);

  const wounded = applyDoomsdayDevil(devil("boj_governor"), player({ hp: 15 }), 1);
  assert.equal(wounded.player.hp, 25);
});

test("discard handles hands with fewer than 2 cards without crashing", () => {
  const oneCard = applyDoomsdayDevil(
    devil("elon_musk"),
    player({ hand: [{ id: "sword" }] }),
    1,
  );
  assert.equal(oneCard.player.hand.length, 0);
  assert.ok(oneCard.log.message.includes("1枚捨てた"));

  const empty = applyDoomsdayDevil(devil("elon_musk"), player({ hand: [] }), 1);
  assert.equal(empty.player.hand.length, 0);
  assert.ok(empty.log.message.includes("0枚捨てた"));
});

test("endTurn during doomsday triggers a devil when the injected rng forces it", () => {
  const state = gameState([
    player({ hand: FULL_HAND.slice(0, 4).map((card) => ({ ...card })) }),
    player({ id: "other", name: "相手" }),
  ]);

  // 1枚目のドロー: 0.1 で出現成功、0.0 でトランプ大統領（重み7の先頭）、
  // 最後の 0.0 は引くカードの抽選。
  const result = endTurn(state, "victim", 1, sequenceRng([0.1, 0.0, 0.0]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const victim = result.state.players.find((entry) => entry.id === "victim");
  assert.equal(victim?.hp, 10);
  assert.equal(victim?.hand.length, 5);

  const devilLog = result.state.log.find((entry) => entry.message.includes("終末の時:"));
  assert.ok(devilLog);
  assert.ok(devilLog?.message.includes("🇺🇸トランプ大統領"));
  assert.ok(devilLog?.message.includes("ツイート砲"));
  assert.ok(devilLog?.message.includes("10ダメージ"));
  assert.equal(devilLog?.damage, 10);
  assert.equal(devilLog?.kind, "system");
});

test("doomsday devils do not appear before doomsday becomes active", () => {
  const result = endTurn(
    gameState(
      [
        player({ hand: FULL_HAND.slice(0, 4).map((card) => ({ ...card })) }),
        player({ id: "other", name: "相手" }),
      ],
      { doomsdayActive: false, doomsdayTurn: null },
    ),
    "victim",
    1,
    sequenceRng([0.0]),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.players.find((entry) => entry.id === "victim")?.hp, 20);
  assert.ok(!result.state.log.some((entry) => entry.message.includes("終末の時:")));
});
