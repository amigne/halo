import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia — provide a stub
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfills required by TipTap / ProseMirror in jsdom
if (typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Ensure getClientRects returns something for ProseMirror cursor positioning
Element.prototype.getClientRects ??= () => ({
  length: 1,
  item: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect),
  [Symbol.iterator]: function* () {
    yield { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
  },
} as unknown as DOMRectList);

// Force French locale for deterministic i18n assertions in tests
Object.defineProperty(navigator, "language", {
  value: "fr",
  configurable: true,
});
