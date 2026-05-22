"use client";

import { useEffect, useState } from "react";

/**
 * Delays element removal from the DOM until an exit animation completes.
 * Returns shouldRender (whether to render the element) and isExiting
 * (whether to apply exit animation classes).
 *
 * Usage:
 *   const { shouldRender, isExiting } = useExitAnimation(isVisible, 350);
 *   {shouldRender && <div className={isExiting ? 'exiting' : ''}>...</div>}
 */
export function useExitAnimation(isVisible: boolean, duration = 350) {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, shouldRender]);

  return { shouldRender, isExiting };
}
