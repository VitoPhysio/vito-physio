import { useEffect, useState } from "react";

type ScrollVisibility = {
  hidden: boolean;
  scrollingUp: boolean;
  pastHeader: boolean;
};

/** Hide shared home chrome while moving down and restore it on the first upward movement. */
export function useScrollVisibility(enabled = true): ScrollVisibility {
  const [visibility, setVisibility] = useState<ScrollVisibility>({
    hidden: false,
    scrollingUp: false,
    pastHeader: false,
  });

  useEffect(() => {
    if (!enabled) {
      setVisibility({ hidden: false, scrollingUp: false, pastHeader: false });
      return;
    }

    let lastY = window.scrollY;
    let downwardDistance = 0;
    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const currentY = Math.max(0, window.scrollY);
        const delta = currentY - lastY;
        const pastHeader = currentY > 64;

        if (currentY < 24) {
          downwardDistance = 0;
          setVisibility({ hidden: false, scrollingUp: false, pastHeader: false });
        } else if (delta < 0) {
          downwardDistance = 0;
          setVisibility({ hidden: false, scrollingUp: true, pastHeader });
        } else if (delta > 0) {
          downwardDistance += delta;
          setVisibility((current) => ({
            hidden: downwardDistance > 10 ? true : current.hidden,
            scrollingUp: false,
            pastHeader,
          }));
          if (downwardDistance > 10) downwardDistance = 0;
        } else {
          setVisibility((current) =>
            current.pastHeader === pastHeader ? current : { ...current, pastHeader },
          );
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

  return visibility;
}
