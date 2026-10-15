import { useEffect, useState } from "react";

/** Hide shared home chrome after downward scroll and restore it promptly on upward scroll. */
export function useScrollVisibility(enabled = true) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }

    let lastY = window.scrollY;
    let accumulatedDelta = 0;
    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const currentY = Math.max(0, window.scrollY);
        const delta = currentY - lastY;

        if (currentY < 24) {
          accumulatedDelta = 0;
          setHidden(false);
        } else if (delta !== 0) {
          if (Math.sign(delta) !== Math.sign(accumulatedDelta)) accumulatedDelta = 0;
          accumulatedDelta += delta;

          if (accumulatedDelta > 10) {
            setHidden(true);
            accumulatedDelta = 0;
          } else if (accumulatedDelta < -10) {
            setHidden(false);
            accumulatedDelta = 0;
          }
        }

        lastY = currentY;
        frame = 0;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return hidden;
}
