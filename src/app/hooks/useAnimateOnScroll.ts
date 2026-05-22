"use client";

import { useEffect, useRef } from "react";

/**
 * IntersectionObserver-based scroll-triggered animation hook.
 * Adds a CSS class to the element when it scrolls into view.
 */
export function useAnimateOnScroll(
  className = "visible",
  options?: IntersectionObserverInit,
) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(className);
          observer.unobserve(entry.target); // Only animate once
        }
      },
      { threshold: 0.1, ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [className, options]);

  return ref;
}
