import {
  type KeyboardEvent,
  type ReactElement,
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Text content of the tooltip. */
  content: string;
  /** The trigger element. Must accept `aria-describedby` and event handlers. */
  children: ReactElement;
  /** Preferred position relative to the trigger. Default: "top". */
  position?: TooltipPosition;
}

/**
 * Accessible tooltip triggered by both keyboard focus and mouse hover.
 *
 * - `aria-describedby` links the trigger to the tooltip
 * - `role="tooltip"`
 * - Short delay on hover (300ms), immediate on focus
 * - Closes on blur, mouseleave, or Escape
 * - Uses `--z-tooltip` token for stacking
 * - Rendered via portal at document.body
 */
export function Tooltip({
  content,
  children,
  position = "top",
}: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 4;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case "right":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }

    // Clamp to viewport
    const padding = 8;
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

    setCoords({ top, left });
  }, [position]);

  const show = useCallback(() => {
    setVisible(true);
    // updatePosition will be called after render via useEffect
  }, []);

  const hide = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setVisible(false);
  }, []);

  const showWithDelay = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      show();
    }, 300);
  }, [show]);

  const handleTriggerKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
      }
    },
    [hide],
  );

  // Update position whenever the tooltip becomes visible
  useEffect(() => {
    if (visible) {
      // RAF to let the browser layout the tooltip first
      requestAnimationFrame(updatePosition);
    }
  }, [visible, updatePosition]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Clone the child to inject event handlers + aria-describedby
  const trigger = cloneElement(children as ReactElement<{
    ref?: React.Ref<HTMLElement>;
    onFocus?: () => void;
    onBlur?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onKeyDown?: (e: KeyboardEvent) => void;
    "aria-describedby"?: string;
  }>, {
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el;
      // Preserve existing ref from child
      const childRef = (children as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof childRef === "function") childRef(el);
      else if (childRef && "current" in childRef) {
        (childRef as React.MutableRefObject<HTMLElement | null>).current = el;
      }
    },
    onFocus: show,
    onBlur: hide,
    onMouseEnter: showWithDelay,
    onMouseLeave: hide,
    onKeyDown: handleTriggerKeyDown,
    "aria-describedby": tooltipId,
  });

  return (
    <>
      {trigger}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="fixed z-[var(--z-tooltip)] px-3 py-1.5 text-xs rounded-md shadow-md bg-text text-surface max-w-xs pointer-events-none"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: "var(--z-tooltip)",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
