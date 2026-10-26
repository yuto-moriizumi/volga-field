import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CARDS, findCard } from "./cards.js";

const shields = BASE_CARDS.filter((card) => card.category === "shield");

test("the shield category contains exactly 50 political defense cards", () => {
  assert.equal(shields.length, 50);
  for (const card of shields) {
    assert.deepEqual(card.customTags, ["political"], `${card.id} tag`);
  }
});

test("all base card IDs are unique", () => {
  const ids = BASE_CARDS.map((card) => card.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every shield has defense and uses the defense amount as its price", () => {
  for (const card of shields) {
    const defense = card.effects.find((effect) => effect.kind === "defense");
    assert.ok(defense, `${card.id} has a defense effect`);
    assert.equal(defense.target, "self", `${card.id} target`);
    assert.ok((defense.amount ?? 0) > 0, `${card.id} defense > 0`);
    assert.equal(card.price, defense.amount, `${card.id} price === defense`);
    assert.equal(card.description, `防御力+${defense.amount}`, `${card.id} description`);
  }
});

test("the existing shield IDs are preserved for battle tests", () => {
  for (const id of ["shield", "great_shield", "leaf_shield"]) {
    assert.ok(findCard(id), `missing shield card: ${id}`);
  }

  assert.equal(findCard("leaf_shield")?.name, "広報誌");
  assert.equal(findCard("shield")?.name, "選挙事務所");
  assert.equal(findCard("great_shield")?.name, "官邸の鉄壁");
  assert.equal(findCard("great_shield")?.description, "防御力+6");
});
