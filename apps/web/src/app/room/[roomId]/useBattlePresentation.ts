"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, PlayerId } from "@volga/shared";
import {
  battleEventDuration,
  deriveBattleEvents,
  type BattleEvent,
  type PresentedBattleEvent,
} from "./battleEvents";

const REDUCED_MOTION_DURATION = 160;

export interface BattlePresentation {
  current: PresentedBattleEvent | null;
  isAnimating: boolean;
  reducedMotion: boolean;
  skip: () => void;
}

/**
 * Turns authoritative state deltas into a sequentially played event queue.
 *
 * The hook only reacts to `gameState` changes, so the first state after mount
 * (or after joining a room) is never animated. Each event owns a timer that is
 * cleaned up on unmount, and `skip` advances the queue immediately.
 */
export function useBattlePresentation(
  gameState: GameState | null,
  playerId: PlayerId | null,
): BattlePresentation {
  const [current, setCurrent] = useState<PresentedBattleEvent | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const currentRef = useRef<PresentedBattleEvent | null>(null);
  const previousStateRef = useRef<GameState | null>(null);
  const queueRef = useRef<BattleEvent[]>([]);
  const keyRef = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const advance = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      currentRef.current = null;
      setCurrent(null);
      return;
    }
    keyRef.current += 1;
    const presented = { event: next, key: keyRef.current };
    currentRef.current = presented;
    setCurrent(presented);
  }, []);

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const skip = useCallback(() => {
    if (!currentRef.current) return;
    advanceRef.current();
  }, []);

  const skipRef = useRef(skip);
  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  useEffect(() => {
    const previous = previousStateRef.current;

    if (!gameState) {
      queueRef.current = [];
      previousStateRef.current = null;
      if (currentRef.current) {
        currentRef.current = null;
        setCurrent(null);
      }
      return;
    }

    if (!previous || previous.roomId !== gameState.roomId) {
      queueRef.current = [];
      previousStateRef.current = gameState;
      if (currentRef.current) {
        currentRef.current = null;
        setCurrent(null);
      }
      return;
    }

    previousStateRef.current = gameState;

    if (gameState.log.length < previous.log.length) {
      // A new game started in the same room: drop stale presentation work.
      queueRef.current = [];
      if (currentRef.current) {
        currentRef.current = null;
        setCurrent(null);
      }
      return;
    }

    const events = deriveBattleEvents(previous, gameState, playerId);
    if (events.length === 0) return;
    queueRef.current.push(...events);
    if (!currentRef.current) advanceRef.current();
  }, [gameState, playerId]);

  useEffect(() => {
    if (!current) return;
    const duration = reducedMotion
      ? REDUCED_MOTION_DURATION
      : battleEventDuration(current.event);
    const timer = window.setTimeout(() => {
      if (currentRef.current?.key === current.key) advanceRef.current();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [current, reducedMotion]);

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== " " && event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      skipRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current]);

  return {
    current,
    isAnimating: current !== null,
    reducedMotion,
    skip,
  };
}
