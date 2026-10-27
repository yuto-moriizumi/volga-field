"use client";

import { useEffect, useRef } from "react";

const DURATION = 420;

/**
 * Counts a number from its previous value to the new one. The authoritative
 * state still updates instantly; this only softens the visual jump.
 *
 * The value is written through a ref so the count-up never re-renders React
 * on every animation frame.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const previousRef = useRef(value);

  useEffect(() => {
    const element = elementRef.current;
    const from = previousRef.current;
    previousRef.current = value;
    if (!element) return;

    if (from === value) {
      element.textContent = String(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - progress) * (1 - progress);
      element.textContent = String(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = String(value);
    };
  }, [value]);

  return <span ref={elementRef}>{value}</span>;
}
