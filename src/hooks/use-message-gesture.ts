import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

const LONG_PRESS_MS = 450;
const SWIPE_REPLY_THRESHOLD = 64;
const SWIPE_MAX_OFFSET = 96;

export function useMessageGesture(canReply: boolean, onActions: () => void, onReply: () => void) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{ x: number; y: number; swiping: boolean; offset: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClick = useRef(false);

  function cancelPress() {
    clearTimeout(timer.current);
    timer.current = undefined;
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function finishGesture(commit: boolean) {
    cancelPress();
    const state = gesture.current;
    gesture.current = null;
    setOffset(0);
    if (!state?.swiping) return;
    suppressClick.current = true;
    if (commit && state.offset >= SWIPE_REPLY_THRESHOLD && canReply) onReply();
  }

  return {
    offset,
    progress: Math.min(offset / SWIPE_REPLY_THRESHOLD, 1),
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!event.isPrimary || event.button !== 0) return;
        // Quoted-message buttons have their own action, not a bubble gesture.
        if (event.target instanceof Element && event.target.closest("button")) return;
        suppressClick.current = false;
        gesture.current = { x: event.clientX, y: event.clientY, swiping: false, offset: 0 };
        cancelPress();
        timer.current = setTimeout(() => {
          gesture.current = null;
          suppressClick.current = true;
          onActions();
        }, LONG_PRESS_MS);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const state = gesture.current;
        if (!state) return;
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelPress();
        if (!state.swiping) {
          if (canReply && dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            state.swiping = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
          } else if (Math.abs(dy) > 10 || dx < -10) {
            // Scrolling must never open actions on pointer release.
            suppressClick.current = true;
            gesture.current = null;
            return;
          }
        }
        if (state.swiping) {
          state.offset = Math.max(0, Math.min(dx, SWIPE_MAX_OFFSET));
          setOffset(state.offset);
        }
      },
      onPointerUp: () => finishGesture(true),
      onPointerCancel() {
        suppressClick.current = true;
        finishGesture(false);
      },
      onPointerLeave() {
        if (!gesture.current?.swiping) {
          cancelPress();
          gesture.current = null;
        }
      },
      onClick() {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onActions();
      },
      onContextMenu(event: { preventDefault: () => void }) {
        event.preventDefault();
        cancelPress();
        gesture.current = null;
        suppressClick.current = true;
        onActions();
      },
      onKeyDown(event: { key: string; preventDefault: () => void }) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActions();
        }
      },
    },
  };
}