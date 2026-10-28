import assert from "node:assert/strict";
import test from "node:test";
import type { BattleLogEntry, GameState, PlayerState } from "@volga/shared";
import {
  deriveBattleEvents,
  parsePartyActionLog,
  type PartyActionEvent,
} from "./[roomId]/battleEvents";
import {
  buildPartyPresentation,
  partyActionAnnouncement,
  partyEffectLabel,
} from "./[roomId]/battleSequence";

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

const partyLog = (
  message: string,
  playerId = "p1",
  damage?: number,
): BattleLogEntry => ({
  turn: 3,
  playerId,
  message,
  kind: "special",
  ...(damage !== undefined ? { damage } : {}),
});

function partyEvents(
  previous: GameState,
  entries: BattleLogEntry[],
): PartyActionEvent[] {
  const next = state({
    players: [
      player("p1", "アリス", { party: "communist_party" }),
      player("p2", "ボブ", { party: "ldp" }),
    ],
    log: [...previous.log, ...entries],
  });
  return deriveBattleEvents(previous, next, "p1").filter(
    (event): event is PartyActionEvent => event.kind === "partyAction",
  );
}

test("parse: damage line names the target and the amount", () => {
  const parsed = parsePartyActionLog(
    "共産党が動いた！ 労働者の反撃: ボブに3ダメージ",
    [{ id: "p1", name: "アリス" }, { id: "p2", name: "ボブ" }],
  );
  assert.deepEqual(parsed, {
    partyName: "共産党",
    actionName: "労働者の反撃",
    targetId: "p2",
    effect: { kind: "damage", amount: 3 },
  });
});

test("parse: heal, mp, money and steal lines", () => {
  const players = [{ id: "p1", name: "アリス" }, { id: "p2", name: "ボブ" }];

  assert.deepEqual(
    parsePartyActionLog("民主党が動いた！ 政策協力: アリスのHPが2回復", players),
    {
      partyName: "民主党",
      actionName: "政策協力",
      targetId: "p1",
      effect: { kind: "heal", amount: 2 },
    },
  );
  assert.deepEqual(
    parsePartyActionLog("共産党が動いた！ 団結: アリスのMPが2回復", players),
    {
      partyName: "共産党",
      actionName: "団結",
      targetId: "p1",
      effect: { kind: "mp", amount: 2 },
    },
  );
  assert.deepEqual(
    parsePartyActionLog("自民党が動いた！ 経済成長: アリスが3円を得た", players),
    {
      partyName: "自民党",
      actionName: "経済成長",
      targetId: "p1",
      effect: { kind: "money", amount: 3 },
    },
  );
  assert.deepEqual(
    parsePartyActionLog("無政府党が動いた！ 略奪: ボブから2円を奪った", players),
    {
      partyName: "無政府党",
      actionName: "略奪",
      targetId: "p2",
      effect: { kind: "steal", amount: 2 },
    },
  );
});

test("parse: a zero MP recovery is still a party action", () => {
  const parsed = parsePartyActionLog(
    "緑の党が動いた！ 再生エネルギー: アリスのMPが0回復",
    [{ id: "p1", name: "アリス" }],
  );
  assert.equal(parsed?.effect.kind, "mp");
  assert.equal(parsed?.effect.amount, 0);
});

test("parse: unrelated special lines are not party actions", () => {
  const players = [{ id: "p1", name: "アリス" }];
  assert.equal(parsePartyActionLog("アリスが共産党に入党した", players), null);
  assert.equal(
    parsePartyActionLog("共産党が動いた！ 労働者の反撃", players),
    null,
  );
  const unknownTarget = parsePartyActionLog(
    "共産党が動いた！ 労働者の反撃: 誰かに3ダメージ",
    players,
  );
  assert.equal(unknownTarget?.targetId, null, "an unknown name only loses the id");
  assert.deepEqual(unknownTarget?.effect, { kind: "damage", amount: 3 });
});

test("event: a damage party action carries the party card id", () => {
  const previous = state();
  const events = partyEvents(previous, [
    partyLog("共産党が動いた！ 労働者の反撃: ボブに3ダメージ", "p1", 3),
  ]);
  assert.equal(events.length, 1);
  const event = events[0]!;
  assert.equal(event.kind, "partyAction");
  assert.equal(event.playerId, "p1");
  assert.equal(event.cardId, "communist_party");
  assert.equal(event.partyName, "共産党");
  assert.equal(event.actionName, "労働者の反撃");
  assert.equal(event.targetId, "p2");
  assert.deepEqual(event.effect, { kind: "damage", amount: 3 });
});

test("event: self-targeted effects point at the party owner", () => {
  const previous = state();
  const events = partyEvents(previous, [
    partyLog("緑の党が動いた！ 自然の恵み: アリスのHPが3回復", "p1"),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.targetId, "p1");
  assert.deepEqual(events[0]?.effect, { kind: "heal", amount: 3 });
  assert.equal(events[0]?.cardId, "green_party");
});

test("event: several party actions keep the log order", () => {
  const previous = state();
  const events = partyEvents(previous, [
    partyLog("共産党が動いた！ 労働者の反撃: ボブに3ダメージ", "p1", 3),
    partyLog("自民党が動いた！ 経済成長: ボブが3円を得た", "p2"),
    partyLog("無政府党が動いた！ 略奪: アリスから2円を奪った", "p2"),
  ]);
  assert.deepEqual(
    events.map((event) => `${event.partyName}:${event.actionName}`),
    ["共産党:労働者の反撃", "自民党:経済成長", "無政府党:略奪"],
  );
});

test("presentation: names, labels and the announcement line", () => {
  const previous = state();
  const events = partyEvents(previous, [
    partyLog("無政府党が動いた！ 略奪: アリスから2円を奪った", "p2"),
  ]);
  const event = events[0]!;
  const party = buildPartyPresentation(
    event,
    [
      { id: "p1", name: "アリス" },
      { id: "p2", name: "ボブ" },
    ],
    "p1",
    7,
  );
  assert.equal(party.key, 7);
  assert.equal(party.actorName, "ボブ");
  assert.equal(party.targetName, "アリス");
  assert.equal(party.isSelfActor, false);
  assert.equal(partyEffectLabel(party.effect), "奪￥2");
  assert.equal(
    partyActionAnnouncement(party),
    "無政府党が動いた！略奪：アリスから2円を奪った",
  );
});

test("presentation: every effect kind has a short label", () => {
  assert.equal(partyEffectLabel({ kind: "damage", amount: 3 }), "攻3");
  assert.equal(partyEffectLabel({ kind: "heal", amount: 3 }), "HP+3");
  assert.equal(partyEffectLabel({ kind: "mp", amount: 2 }), "MP+2");
  assert.equal(partyEffectLabel({ kind: "money", amount: 3 }), "￥+3");
  assert.equal(partyEffectLabel({ kind: "steal", amount: 2 }), "奪￥2");
});
