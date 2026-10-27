"use client";

import { useState, useSyncExternalStore } from "react";

const PLAYER_NAME_KEY = "volga-player-name";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot(): string | null {
  return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
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
