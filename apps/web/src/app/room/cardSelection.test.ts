import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CARDS, findCard } from "@volga/game-core";
import { defaultTargetId, isAttackCard } from "./[roomId]/cardSelection";
import { shortPower } from "./[roomId]/CardView";
import { largeCardPower } from "./[roomId]/LargeCard";

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

test("party cards on the field are labeled 入党, not 攻+", () => {
  const partyCards = BASE_CARDS.filter((card) => card.category === "party");
  assert.ok(partyCards.length > 0);
  for (const card of partyCards) {
    assert.equal(largeCardPower(card), "入党", card.id);
  }
});

test("cards with no effects are not labeled as attacks", () => {
  const emptyEffectCards = BASE_CARDS.filter(
    (card) => card.effects.length === 0 && card.category !== "trade",
  );
  for (const card of emptyEffectCards) {
    assert.doesNotMatch(largeCardPower(card), /^攻/, card.id);
  }
});

test("field labels keep attack, shield, and MP+ formatting", () => {
  for (const card of ATTACK_POWER_CARDS) {
    const definition = findCard(card.id);
    assert.ok(definition);
    assert.equal(
      largeCardPower(definition),
      `攻+${card.effects[0]?.amount ?? ""}`,
    );
  }
  const sword = findCard("sword");
  assert.ok(sword);
  assert.match(largeCardPower(sword), /^攻\d+$/);
  const shield = findCard("shield");
  assert.ok(shield);
  assert.equal(largeCardPower(shield), "守3");
  const nobori = findCard("nobori");
  assert.ok(nobori);
  assert.equal(largeCardPower(nobori), "MP+1");
  const heal = findCard("heal");
  assert.ok(heal);
  assert.equal(largeCardPower(heal), "MP7");
});

test("communist party is a regression guard against the empty every() label", () => {
  const communist = findCard("communist_party");
  assert.ok(communist);
  assert.equal(largeCardPower(communist), "入党");
  assert.notEqual(largeCardPower(communist), "攻+");
  assert.doesNotMatch(largeCardPower(communist), /^攻/);
});
