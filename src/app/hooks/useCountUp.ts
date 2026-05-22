"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Animated number counting hook.
 * Smoothly counts from 0 (or previous value) to the target number.
 */
export function useCountUp(
  target: number,
  options?: { duration?: number; enabled?: boolean },
) {
  const { duration = 800, enabled = true } = options ?? {};
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }

    const from = prevRef.current;
    const diff = target - from;
    if (diff === 0) return;

    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + diff * eased;

      setDisplay(Math.round(value));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = target;
        frameRef.current = null;
      }
    }

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, duration, enabled]);

  return display;
}
