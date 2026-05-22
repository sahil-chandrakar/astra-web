"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Removes `will-change` from elements after their entrance animation completes.
 * This prevents GPU memory waste from persistent `will-change` on elements
 * that only animate once (like panel-entry or motion-stagger-item).
 *
 * Usage: const containerRef = useAnimationCleanup();
 * Then attach ref to a parent container. All children with `.panel-entry`
 * or `.motion-stagger-item` will have `will-change` cleared after animation.
 */
export function useAnimationCleanup() {
  const ref = useRef<HTMLElement | null>(null);

  const handleAnimationEnd = useCallback((event: AnimationEvent) => {
    const target = event.target as HTMLElement;
    if (
      target.classList.contains("panel-entry") ||
      target.classList.contains("motion-stagger-item") ||
      target.classList.contains("motion-stagger-fast")
    ) {
      target.classList.add("animation-done");
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener("animationend", handleAnimationEnd as EventListener);
    return () => {
      el.removeEventListener("animationend", handleAnimationEnd as EventListener);
    };
  }, [handleAnimationEnd]);

  return ref;
}
