import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InfiniteSentinel } from "./InfiniteSentinel";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

function stubObserver() {
  const state = {
    callback: null as ObserverCallback | null,
    options: null as IntersectionObserverInit | null,
    disconnect: vi.fn(),
  };
  class FakeObserver {
    constructor(
      callback: ObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      state.callback = callback;
      state.options = options ?? null;
    }
    observe() {}
    disconnect() {
      state.disconnect();
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InfiniteSentinel", () => {
  it("asks for more when it scrolls into view", () => {
    const observer = stubObserver();
    const onVisible = vi.fn();
    render(<InfiniteSentinel onVisible={onVisible} disabled={false} />);

    observer.callback?.([{ isIntersecting: false }]);
    expect(onVisible).not.toHaveBeenCalled();

    observer.callback?.([{ isIntersecting: true }]);
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("does not watch while disabled", () => {
    const observer = stubObserver();
    render(<InfiniteSentinel onVisible={vi.fn()} disabled />);

    expect(observer.callback).toBeNull();
  });

  it("stops watching when it unmounts", () => {
    const observer = stubObserver();
    const { unmount } = render(
      <InfiniteSentinel onVisible={vi.fn()} disabled={false} />,
    );

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("watches inside the scroll container it is given", () => {
    const observer = stubObserver();
    const container = document.createElement("div");
    render(
      <InfiniteSentinel
        onVisible={vi.fn()}
        disabled={false}
        scrollRef={{ current: container }}
      />,
    );

    expect(observer.options?.root).toBe(container);
  });
});
