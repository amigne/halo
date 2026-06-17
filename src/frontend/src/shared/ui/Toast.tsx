import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastType = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to add/remove toasts. Must be used inside `<ToastProvider>`.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────

let toastCounter = 0;

const DEFAULT_DURATION = 5000; // 5 seconds

const typeStyles: Record<ToastType, string> = {
  info: "border-l-primary bg-surface text-text",
  success: "border-l-success bg-surface text-text",
  error: "border-l-danger bg-surface text-text",
  warning: "border-l-warning bg-surface text-text",
};

const typeIcons: Record<ToastType, string> = {
  info: "ℹ",
  success: "✓",
  error: "✕",
  warning: "⚠",
};

/**
 * Toast notification provider.
 *
 * - Wraps the app, providing `useToast()` hook
 * - Container is a `aria-live="polite"` region
 * - Error/warning toasts use `role="alert"`; info/success use `role="status"`
 * - Auto-dismiss after configurable `duration` (default 5s)
 * - Respects `prefers-reduced-motion` via the global CSS rule
 * - z-index via `--z-toast` token
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = `toast-${++toastCounter}`;
      const toast: Toast = { id, type, message, duration };
      setToasts((prev) => [...prev, toast]);

      const ms = duration ?? DEFAULT_DURATION;
      const timer = setTimeout(() => removeToast(id), ms);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: "var(--z-toast)" }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" || toast.type === "warning" ? "alert" : "status"}
            className={`pointer-events-auto flex items-center gap-3 p-3 rounded-md border-l-4 shadow-md min-w-[280px] max-w-sm text-sm ${typeStyles[toast.type]}`}
          >
            <span aria-hidden="true" className="text-base shrink-0">
              {typeIcons[toast.type]}
            </span>
            <span className="flex-1">{toast.message}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeToast(toast.id)}
              aria-label={t("ui.toast.close")}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
