import "@testing-library/jest-dom";

// jsdom lacks ResizeObserver, which react-zoom-pan-pinch relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
