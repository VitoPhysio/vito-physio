import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMessageGesture } from "@/hooks/use-message-gesture";

function pointer(x: number, y = 0): PointerEvent<HTMLElement> {
  return { clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1,
    target: document.createElement("div"), currentTarget: document.createElement("div") } as unknown as PointerEvent<HTMLElement>;
}

function setup(canReply = true) {
  const actions = vi.fn();
  const reply = vi.fn();
  const hook = renderHook(() => useMessageGesture(canReply, actions, reply));
  return { hook, actions, reply };
}

afterEach(() => vi.useRealTimers());
describe("chat message interactions", () => {
  it("opens reply and reaction actions on tap", () => {
    const { hook, actions } = setup();
    act(() => hook.result.current.handlers.onClick());
    expect(actions).toHaveBeenCalledTimes(1);
  });
  it("opens actions once on long press, suppressing the release click", () => {
    vi.useFakeTimers();
    const { hook, actions } = setup();
    act(() => hook.result.current.handlers.onPointerDown(pointer(0)));
    act(() => vi.advanceTimersByTime(449));
    expect(actions).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    act(() => { hook.result.current.handlers.onPointerUp(); hook.result.current.handlers.onClick(); });
    expect(actions).toHaveBeenCalledTimes(1);
  });
  it("swiping right replies without also opening actions", () => {
    const { hook, reply, actions } = setup();
    act(() => hook.result.current.handlers.onPointerDown(pointer(0)));
    act(() => hook.result.current.handlers.onPointerMove(pointer(64)));
    act(() => { hook.result.current.handlers.onPointerUp(); hook.result.current.handlers.onClick(); });
    expect(reply).toHaveBeenCalledTimes(1);
    expect(actions).not.toHaveBeenCalled();
    expect(hook.result.current.offset).toBe(0);
  });
  it("a short swipe does not reply", () => {
    const { hook, reply } = setup();
    act(() => hook.result.current.handlers.onPointerDown(pointer(0)));
    act(() => hook.result.current.handlers.onPointerMove(pointer(63)));
    act(() => hook.result.current.handlers.onPointerUp());
    expect(reply).not.toHaveBeenCalled();
  });
  it("vertical scrolling does not reply or open actions", () => {
    vi.useFakeTimers();
    const { hook, reply, actions } = setup();
    act(() => hook.result.current.handlers.onPointerDown(pointer(0)));
    act(() => hook.result.current.handlers.onPointerMove(pointer(2, 80)));
    act(() => vi.advanceTimersByTime(500));
    act(() => { hook.result.current.handlers.onPointerUp(); hook.result.current.handlers.onClick(); });
    expect(reply).not.toHaveBeenCalled();
    expect(actions).not.toHaveBeenCalled();
  });
  it("cancelled swipes do not reply", () => {
    const { hook, reply } = setup();
    act(() => hook.result.current.handlers.onPointerDown(pointer(0)));
    act(() => hook.result.current.handlers.onPointerMove(pointer(80)));
    act(() => hook.result.current.handlers.onPointerCancel());
    expect(reply).not.toHaveBeenCalled();
    expect(hook.result.current.offset).toBe(0);
  });
  it("deleted or unavailable messages cannot swipe to reply", () => {
    const { hook, reply } = setup(false);
    act(() => hook.result.current.handlers.onPointerDown(pointer(0)));
    act(() => hook.result.current.handlers.onPointerMove(pointer(80)));
    act(() => hook.result.current.handlers.onPointerUp());
    expect(reply).not.toHaveBeenCalled();
  });
});