import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CARDS, findCard } from "@volga/game-core";
import { defaultTargetId, isAttackCard } from "./[roomId]/cardSelection";
import { shortPower } from "./[roomId]/CardView";

const ATTACK_POWER_CARDS = BASE_CARDS.filter(
  (card) =>
    card.effects.length > 0 &&
    card.effects.every((effect) => effect.kind === "attack_power"),
);

test("attack_power-only cards are treated as attack cards", () => {
  assert.ok(ATTACK_POWER_CARDS.length > 0);
  for (const card of ATTACK_POWER_CARDS) {
    assert.equal(isAttackCard(card.id), true, card.id);
  }
});

test("direct damage weapons and attack_power cards target another player", () => {
  const power = findCard("socialist_power_4");
  assert.ok(power);
  assert.equal(defaultTargetId("socialist_power_4", "p1", "p2"), "p2");
  assert.equal(defaultTargetId("sword", "p1", "p2"), "p2");
  assert.equal(defaultTargetId("buy", "p1", "p2"), "p2");
});

test("support cards still target the user", () => {
  assert.equal(isAttackCard("heal"), false);
  assert.equal(isAttackCard("shield"), false);
  assert.equal(defaultTargetId("heal", "p1", "p2"), "p1");
  assert.equal(defaultTargetId("shield", "p1", "p2"), "p1");
});

test("an attack without another player has no target", () => {
  assert.equal(defaultTargetId("socialist_power_4", "p1", null), undefined);
});

test("hand captions render attack_power as 攻+N", () => {
  for (const card of ATTACK_POWER_CARDS) {
    const definition = findCard(card.id);
    assert.ok(definition);
    assert.equal(shortPower(definition), `攻+${card.effects[0]?.amount ?? ""}`);
  }
  const sword = findCard("sword");
  assert.ok(sword);
  assert.match(shortPower(sword), /^攻\d+$/);
});
