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

// Force French locale for deterministic i18n assertions in tests
Object.defineProperty(navigator, "language", {
  value: "fr",
  configurable: true,
});
