import { useEffect, useState } from "react";

export type Breakpoint = "smartphone" | "tablet" | "desktop";

/**
 * Breakpoint resolution matching spec §2 (U-010..U-014):
 * - ≤768px → "smartphone"
 * - 769–1023px → "tablet"
 * - ≥1024px → "desktop"
 *
 * Uses `window.matchMedia` with live listeners — no resize debouncing needed.
 */
export function computeBreakpoint(width: number): Breakpoint {
  if (width <= 768) return "smartphone";
  if (width <= 1023) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    computeBreakpoint(window.innerWidth),
  );

  useEffect(() => {
    // We need three overlapping queries to have clear boundaries
    const smartphoneMq = window.matchMedia("(max-width: 768px)");
    const tabletMq = window.matchMedia(
      "(min-width: 769px) and (max-width: 1023px)",
    );
    const desktopMq = window.matchMedia("(min-width: 1024px)");

    function update() {
      if (smartphoneMq.matches) setBp("smartphone");
      else if (tabletMq.matches) setBp("tablet");
      else if (desktopMq.matches) setBp("desktop");
      // fallback: keep current
    }

    // Initial sync (belt-and-suspenders with the useState initializer)
    update();

    smartphoneMq.addEventListener("change", update);
    tabletMq.addEventListener("change", update);
    desktopMq.addEventListener("change", update);

    return () => {
      smartphoneMq.removeEventListener("change", update);
      tabletMq.removeEventListener("change", update);
      desktopMq.removeEventListener("change", update);
    };
  }, []);

  return bp;
}
