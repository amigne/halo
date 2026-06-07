import { type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/shared/theme/store";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider>{children}</ThemeProvider>;
  };
}

describe("Theme store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("defaults to system when no stored preference", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });
    expect(result.current.theme).toBe("system");
  });

  it("reads stored theme preference from localStorage", () => {
    localStorageMock.setItem("halo-theme", "dark");

    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });
    expect(result.current.theme).toBe("dark");
  });

  it("changes theme and persists to localStorage", () => {
    // Start from system so that localStorage is clear
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.theme).toBe("dark");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("halo-theme", "dark");
  });

  it("cycles through light, dark, and system themes", () => {
    // Start from system (default)
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setTheme("light");
    });
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.setTheme("system");
    });
    expect(result.current.theme).toBe("system");
  });

  it("resolves system theme to light when prefers-color-scheme is light", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe("system");
    // Global jsdom mock returns matches: false → light mode
    expect(result.current.resolved).toBe("light");
  });

  it("resolves stored dark theme correctly", () => {
    localStorageMock.setItem("halo-theme", "dark");

    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });
    expect(result.current.resolved).toBe("dark");
  });

  it("throws error when useTheme used outside ThemeProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within a ThemeProvider",
    );

    spy.mockRestore();
  });
});
