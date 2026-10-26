import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CARDS } from "./cards.js";

test("every base card has a unique emoji icon", () => {
  const byEmoji = new Map<string, string[]>();
  for (const card of BASE_CARDS) {
    const ids = byEmoji.get(card.emoji) ?? [];
    ids.push(card.id);
    byEmoji.set(card.emoji, ids);
  }

  const duplicates = [...byEmoji.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([emoji, ids]) => `${emoji}: ${ids.join(", ")}`);

  assert.deepEqual(duplicates, [], `duplicate card icons:\n${duplicates.join("\n")}`);
});
