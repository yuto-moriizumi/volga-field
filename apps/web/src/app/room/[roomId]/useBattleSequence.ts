"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, PlayerId } from "@volga/shared";
import {
  battleEventDuration,
  deriveBattleEvents,
  type BattleEvent,
  type PresentedBattleEvent,
} from "./battleEvents";
import {
  DUEL_DEFENSE_STEP_MS,
  DUEL_STEP_MS,
  DUEL_TURN_HOLD_MS,
  DUEL_TURN_SETTLE_MS,
  absorbDraw,
  buildDuelPresentation,
  planDuels,
  updateDuelModel,
  type DuelCard,
  type DuelModel,
  type DuelPresentation,
  type DuelStage,
} from "./battleSequence";

interface DuelRun extends DuelModel {
  stage: DuelStage;
  /** Waiting for the viewer to pick defense cards (only when the viewer defends). */
  awaitingDefense: boolean;
  /** The defense card is shown but the damage has not arrived yet. */
  waitingForEffect: boolean;
  /** `performance.now()` of the resolution state, used for the settle window. */
  resolvedAt: number | null;
}

type QueueItem =
  | { kind: "duel"; model: DuelModel }
  | { kind: "overlay"; event: BattleEvent };

export interface BattleSequence {
  duel: DuelPresentation | null;
  /** Non-duel events still use the full-screen overlay. */
  overlay: PresentedBattleEvent | null;
  isAnimating: boolean;
  /** True while the viewer may confirm a defense inside the sequence. */
  canDefend: boolean;
  /**
   * True only after a resync (reload with an attack already pending), where no
   * sequence will be created. The legacy defense UI may then be used.
   */
  defenseFallback: boolean;
  interactionLocked: boolean;
  reducedMotion: boolean;
  skip: () => void;
  notifyDefense: (cards: DuelCard[]) => void;
}

/**
 * Plays state deltas as a field-based duel sequence.
 *
 * Only one presentation is active at a time: duels and the legacy overlays
 * share a single queue, so the two can never be shown together. Steps are
 * advanced by timers, never by the arrival of new data, which keeps the cadence
 * at 300ms even when the server sends the attack and its resolution together.
 */
export function useBattleSequence(
  gameState: GameState | null,
  playerId: PlayerId | null,
): BattleSequence {
  const [duel, setDuel] = useState<DuelPresentation | null>(null);
  const [overlay, setOverlay] = useState<PresentedBattleEvent | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [defenseFallback, setDefenseFallback] = useState(false);

  const runRef = useRef<DuelRun | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const overlayRef = useRef<PresentedBattleEvent | null>(null);
  const previousStateRef = useRef<GameState | null>(null);
  const processedStateRef = useRef<GameState | null>(null);
  const timerRef = useRef<number | null>(null);
  const keyRef = useRef(0);
  const epochRef = useRef(0);
  const playerIdRef = useRef<PlayerId | null>(playerId);
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);
  // Declared up front because the timer chain and the queue reference each
  // other; every entry point is only ever called after render.
  const startDuelRef = useRef<(model: DuelModel) => void>(() => {});
  const advanceToTurnRef = useRef<(run: DuelRun, epoch: number) => void>(
    () => {},
  );
  const advanceToEffectRef = useRef<(run: DuelRun, epoch: number) => void>(
    () => {},
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const publish = useCallback((run: DuelRun) => {
    setDuel(
      buildDuelPresentation(
        run,
        run.stage,
        run.awaitingDefense,
        playerIdRef.current,
      ),
    );
  }, []);

  const after = useCallback(
    (ms: number, epoch: number, callback: () => void) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (epochRef.current !== epoch) return;
        callback();
      }, ms);
    },
    [clearTimer],
  );

  const pump = useCallback(() => {
    if (runRef.current || overlayRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    if (next.kind === "overlay") {
      keyRef.current += 1;
      const presented = { event: next.event, key: keyRef.current };
      overlayRef.current = presented;
      setOverlay(presented);
      return;
    }
    startDuelRef.current(next.model);
  }, []);

  const finishDuel = useCallback(
    (run: DuelRun) => {
      if (runRef.current !== run) return;
      clearTimer();
      runRef.current = null;
      setDuel(null);
      pump();
    },
    [clearTimer, pump],
  );

  const advanceToTurn = useCallback(
    (run: DuelRun, epoch: number) => {
      if (runRef.current !== run) return;
      if (!run.turn && run.resolvedAt !== null) {
        // The turn end may still be on its way as a separate state. Give it a
        // short window before concluding that the turn did not change.
        const remaining =
          DUEL_TURN_SETTLE_MS - (performance.now() - run.resolvedAt);
        if (remaining > 1) {
          after(remaining, epoch, () => advanceToTurnRef.current(run, epoch));
          return;
        }
      }
      if (run.turn) {
        run.stage = "turn";
        publish(run);
        after(DUEL_TURN_HOLD_MS, epoch, () => finishDuel(run));
      } else {
        finishDuel(run);
      }
    },
    [after, finishDuel, publish],
  );
  useEffect(() => {
    advanceToTurnRef.current = advanceToTurn;
  }, [advanceToTurn]);

  const advanceToEffect = useCallback(
    (run: DuelRun, epoch: number) => {
      if (runRef.current !== run) return;
      run.waitingForEffect = false;
      run.stage = "effect";
      publish(run);
      after(DUEL_STEP_MS, epoch, () => advanceToTurnRef.current(run, epoch));
    },
    [after, publish],
  );
  useEffect(() => {
    advanceToEffectRef.current = advanceToEffect;
  }, [advanceToEffect]);

  const scheduleEffect = useCallback(
    (run: DuelRun, epoch: number) => {
      if (runRef.current !== run) return;
      run.stage = "defense";
      publish(run);
      after(DUEL_STEP_MS, epoch, () => {
        if (runRef.current !== run) return;
        if (!run.effect) {
          // Hold the defense card until the damage is known.
          run.waitingForEffect = true;
          return;
        }
        advanceToEffect(run, epoch);
      });
    },
    [after, advanceToEffect, publish],
  );

  const advanceFromTarget = useCallback(
    (run: DuelRun, epoch: number) => {
      if (runRef.current !== run) return;
      scheduleEffect(run, epoch);
    },
    [scheduleEffect],
  );

  const advanceFromAttack = useCallback(
    (run: DuelRun, epoch: number) => {
      if (runRef.current !== run) return;
      run.stage = "target";
      publish(run);
      // The defender only gets the defense UI once the name is on screen, and
      // the timeline waits for their decision.
      if (!run.effect && run.defenderId === playerIdRef.current) {
        run.awaitingDefense = true;
        publish(run);
        return;
      }
      after(DUEL_STEP_MS, epoch, () => advanceFromTarget(run, epoch));
    },
    [after, advanceFromTarget, publish],
  );

  const startDuel = useCallback(
    (model: DuelModel) => {
      if (runRef.current) return;
      const epoch = epochRef.current;
      const run: DuelRun = {
        ...model,
        stage: "clear",
        awaitingDefense: false,
        waitingForEffect: false,
        resolvedAt: model.effect ? performance.now() : null,
      };
      runRef.current = run;
      publish(run);
      after(DUEL_STEP_MS, epoch, () => {
        if (runRef.current !== run) return;
        run.stage = "attack";
        publish(run);
        after(DUEL_STEP_MS, epoch, () => advanceFromAttack(run, epoch));
      });
    },
    [after, advanceFromAttack, publish],
  );
  useEffect(() => {
    startDuelRef.current = startDuel;
  }, [startDuel]);

  const notifyDefense = useCallback(
    (cards: DuelCard[]) => {
      const run = runRef.current;
      if (!run || !run.awaitingDefense) return;
      const epoch = epochRef.current;
      run.awaitingDefense = false;
      run.defenseCards = cards;
      run.stage = "defenseClear";
      publish(run);
      after(DUEL_DEFENSE_STEP_MS, epoch, () => {
        if (runRef.current !== run) return;
        scheduleEffect(run, epoch);
      });
    },
    [after, publish, scheduleEffect],
  );

  const reset = useCallback(() => {
    epochRef.current += 1;
    clearTimer();
    runRef.current = null;
    queueRef.current = [];
    overlayRef.current = null;
    setDuel(null);
    setOverlay(null);
  }, [clearTimer]);

  const skip = useCallback(() => {
    const run = runRef.current;
    if (run) {
      // Never skip the step that is waiting for the viewer's defense.
      if (run.awaitingDefense) return;
      finishDuel(run);
      return;
    }
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
      pump();
    }
  }, [finishDuel, pump]);

  // The delta is folded in a microtask so React never sees a synchronous
  // setState from an effect body; it still runs before the next paint, so the
  // first step of a sequence starts on the same frame as the state update.
  const consumeDelta = useCallback(
    (previous: GameState, next: GameState) => {
      // A real delta always owns its presentation, so the legacy defense UI is
      // not used (it would flash before the sequence reaches the name step).
      setDefenseFallback(false);
      const events = deriveBattleEvents(previous, next, playerIdRef.current);
      let remaining = events;

      // 1. Build every duel declared in this delta (the server can chain my
      //    attack, its resolution and the AI's counterattack into one state).
      const planned = planDuels(
        previous,
        next,
        playerIdRef.current,
        remaining,
        keyRef.current + 1,
      );
      if (planned.duels.length > 0) {
        keyRef.current += planned.duels.length;
        for (const model of planned.duels) {
          queueRef.current.push({ kind: "duel", model });
        }
        remaining = remaining.filter(
          (event) => !planned.consumed.includes(event),
        );
      }

      // 2. Fold this delta into the running duel.
      const run = runRef.current;
      if (run) {
        const update = updateDuelModel(
          run,
          previous,
          next,
          playerIdRef.current,
          remaining,
        );
        const hadEffect = run.effect !== null;
        run.effect = update.model.effect;
        run.defenseCards = update.model.defenseCards;
        run.recoil = update.model.recoil;
        run.turn = update.model.turn;
        remaining = remaining.filter(
          (event) => !update.consumed.includes(event),
        );

        if (!hadEffect && run.effect) {
          run.resolvedAt = performance.now();
          if (run.waitingForEffect) {
            advanceToEffectRef.current(run, epochRef.current);
          }
        }

        const absorbed = absorbDraw(run, remaining);
        if (absorbed.consumed.length > 0) {
          run.drawCount = absorbed.model.drawCount;
          remaining = remaining.filter(
            (event) => !absorbed.consumed.includes(event),
          );
        }

        // Safety net: if the defense was resolved elsewhere (disconnect,
        // another client), do not stay on the name step forever.
        if (run.awaitingDefense && (!next.pendingAttack || next.winner)) {
          run.awaitingDefense = false;
          if (run.defenseCards === null) run.defenseCards = [];
          publish(run);
          advanceFromTarget(run, epochRef.current);
        }
      }

      // 3. Queued duels still need their resolution and turn change.
      queueRef.current = queueRef.current.map((item) => {
        if (item.kind !== "duel") return item;
        const update = updateDuelModel(
          item.model,
          previous,
          next,
          playerIdRef.current,
          remaining,
        );
        remaining = remaining.filter(
          (event) => !update.consumed.includes(event),
        );
        return { kind: "duel", model: update.model };
      });

      // 4. Everything left is a non-duel event and keeps the overlay.
      for (const event of remaining) {
        queueRef.current.push({ kind: "overlay", event });
      }

      pump();
    },
    [advanceFromTarget, publish, pump],
  );

  useEffect(() => {
    if (!gameState) {
      previousStateRef.current = null;
      processedStateRef.current = null;
      queueMicrotask(() => reset());
      return;
    }
    if (processedStateRef.current === gameState) return;
    processedStateRef.current = gameState;

    const previous = previousStateRef.current;
    previousStateRef.current = gameState;
    if (!previous || previous.roomId !== gameState.roomId) {
      queueMicrotask(() => {
        reset();
        // Only a reload that already has an attack waiting for *this* player
        // needs the legacy defense UI. Otherwise the sequence owns it, and the
        // one render before the sequence starts must not show a defense button.
        setDefenseFallback(
          gameState.phase === "defense" &&
            gameState.pendingAttack?.defenderId === playerId,
        );
      });
      return;
    }
    if (gameState.log.length < previous.log.length) {
      // A new game started in the same room: drop stale presentation work.
      queueMicrotask(() => reset());
      return;
    }

    queueMicrotask(() => consumeDelta(previous, gameState));
  }, [gameState, playerId, consumeDelta, reset]);

  useEffect(() => {
    if (!overlay) return;
    const timer = window.setTimeout(() => {
      overlayRef.current = null;
      setOverlay(null);
      pump();
    }, battleEventDuration(overlay.event));
    return () => window.clearTimeout(timer);
  }, [overlay, pump]);

  useEffect(() => {
    if (!overlay) return;
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
      skip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlay, skip]);

  useEffect(
    () => () => {
      epochRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const isAnimating = duel !== null || overlay !== null;
  const interactionLocked =
    overlay !== null || (duel !== null && !duel.awaitingDefense);

  return {
    duel,
    overlay,
    isAnimating,
    canDefend: duel?.awaitingDefense ?? false,
    defenseFallback,
    interactionLocked,
    reducedMotion,
    skip,
    notifyDefense,
  };
}
