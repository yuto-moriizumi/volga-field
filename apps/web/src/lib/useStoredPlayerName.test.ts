import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DEFAULT_PLAYER_NAME, storePlayerName } from "./useStoredPlayerName";

const originalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test("storePlayerName writes the name to localStorage", () => {
  const writes: Array<[string, string]> = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      setItem: (key: string, value: string) => writes.push([key, value]),
    },
  });

  storePlayerName("ヴォルガ");

  assert.deepEqual(writes, [["volga-player-name", "ヴォルガ"]]);
});

test("storePlayerName never throws when storage is blocked", () => {
  // Safari のプライベートモードなど、localStorage へのアクセスが例外になる環境。
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });

  assert.doesNotThrow(() => storePlayerName("ヴォルガ"));
});

test("the default player name is ヴォルガ", () => {
  assert.equal(DEFAULT_PLAYER_NAME, "ヴォルガ");
});
