"use client";

import { useState, useSyncExternalStore } from "react";

const PLAYER_NAME_KEY = "volga-player-name";

/** Shown when the player starts without typing a name. */
export const DEFAULT_PLAYER_NAME = "ヴォルガ";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readStoredName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
  } catch {
    // Safari のプライベートモードや埋め込みブラウザでは localStorage への
    // アクセス自体が例外になる。名前が読めないだけで画面を壊さないようにする。
    return "";
  }
}

/**
 * Persists the player name, best effort.
 *
 * Storage can be unavailable (blocked cookies, in-app browsers). Failing to
 * persist must never stop the player from starting a game.
 */
export function storePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // 保存できなくても、その場のプレイは続けられる。
  }
}

function getSnapshot(): string {
  return readStoredName();
}

function getServerSnapshot(): string | null {
  // `null` means "not hydrated yet"; an empty string means "nothing stored".
  return null;
}

/**
 * Reads the player name persisted in localStorage.
 *
 * `useSyncExternalStore` renders the server snapshot during SSR/hydration and
 * switches to the stored value afterwards, so the initial read does not need a
 * `setState` inside an effect. `setName` only updates the in-memory draft;
 * persisting it stays with the caller.
 */
export function useStoredPlayerName() {
  const storedName = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [draftName, setDraftName] = useState<string | null>(null);
  return {
    /** Stored value, or `null` while server-rendering / hydrating. */
    storedName,
    name: draftName ?? storedName ?? "",
    setName: setDraftName,
  };
}
