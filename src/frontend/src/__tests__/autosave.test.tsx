import { type ReactNode } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18next } from "@/shared/i18n";
import { useAutosaveField } from "@/shared/autosave/use-autosave-field";
import { SaveIndicator } from "@/shared/autosave/SaveIndicator";
import { AutosaveField } from "@/shared/autosave/AutosaveField";

// ── Helpers ────────────────────────────────────────────────────────────────────

function I18nWrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}

/** Controlled test component that uses the useAutosaveField hook directly. */
function TestField({
  value,
  fieldKey = "title",
  onPatch,
  debounceMs,
}: {
  value: string;
  fieldKey?: string;
  onPatch: (partial: Record<string, string>) => Promise<void>;
  debounceMs?: number;
}) {
  const api = useAutosaveField({ value, fieldKey, onPatch, debounceMs });

  return (
    <I18nWrapper>
      <div>
        <input
          data-testid="input"
          type="text"
          value={api.localValue}
          onChange={(e) => api.onChange(e.target.value)}
          onBlur={api.onBlur}
          onKeyDown={api.handleKeyDown}
        />
        <SaveIndicator
          status={api.status}
          error={api.error}
          onRetry={api.retry}
        />
        <span data-testid="dirty">{api.isDirty ? "dirty" : "clean"}</span>
      </div>
    </I18nWrapper>
  );
}

// ── Timers ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── useAutosaveField hook ──────────────────────────────────────────────────────

describe("useAutosaveField", () => {
  // ── Basic editing ──────────────────────────────────────────────────────────

  it("initialises with the provided value", () => {
    const onPatch = vi.fn();
    render(
      <TestField value="Hello" onPatch={onPatch} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.value).toBe("Hello");
  });

  it("updates local value on change without calling onPatch", () => {
    const onPatch = vi.fn();
    render(
      <TestField value="Hello" onPatch={onPatch} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Hello world" } });

    expect(input.value).toBe("Hello world");
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("marks the field as dirty when value differs from snapshot", () => {
    const onPatch = vi.fn();
    render(
      <TestField value="Hello" onPatch={onPatch} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    expect(screen.getByTestId("dirty").textContent).toBe("clean");

    fireEvent.change(input, { target: { value: "Changed" } });

    expect(screen.getByTestId("dirty").textContent).toBe("dirty");
  });

  // ── Blur → persist (debounced) ─────────────────────────────────────────────

  it("calls onPatch after blur + debounce delay", async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(
      <TestField value="Hello" onPatch={onPatch} debounceMs={300} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    // Change value
    fireEvent.change(input, { target: { value: "Updated" } });
    expect(onPatch).not.toHaveBeenCalled();

    // Blur — debounce timer starts
    fireEvent.blur(input);
    expect(onPatch).not.toHaveBeenCalled();

    // Fast-forward past debounce
    await act(() => vi.advanceTimersByTimeAsync(350));

    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ title: "Updated" });
  });

  it("does not call onPatch on blur if value is unchanged", async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(
      <TestField value="Same" onPatch={onPatch} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.blur(input);
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(onPatch).not.toHaveBeenCalled();
  });

  it("transitions status: idle → saving → saved", async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(
      <TestField value="Start" onPatch={onPatch} debounceMs={200} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "New" } });
    fireEvent.blur(input);

    // Status should be "idle" during debounce (not yet saving)
    // Advance past debounce → save starts
    await act(() => vi.advanceTimersByTimeAsync(250));

    expect(onPatch).toHaveBeenCalled();
    // After resolve, should show "saved"
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  // ── Escape restores snapshot ───────────────────────────────────────────────

  it("restores snapshot on Escape when dirty (U-062)", () => {
    const onPatch = vi.fn();
    render(
      <TestField value="Original" onPatch={onPatch} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Modified" } });
    expect(input.value).toBe("Modified");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("Original");
    expect(screen.getByTestId("dirty").textContent).toBe("clean");
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("does not restore when Escape is pressed on a clean field", () => {
    const onPatch = vi.fn();
    render(
      <TestField value="Unchanged" onPatch={onPatch} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("Unchanged");
  });

  it("handleKeyDown returns true when Escape restores (event consumed)", () => {
    const onPatch = vi.fn();
    let capturedResult: boolean | undefined;

    function CaptureTest() {
      const api = useAutosaveField({
        value: "Before",
        fieldKey: "title",
        onPatch,
      });

      return (
        <I18nWrapper>
          <input
            data-testid="input"
            type="text"
            value={api.localValue}
            onChange={(e) => api.onChange(e.target.value)}
            onKeyDown={(e) => {
              capturedResult = api.handleKeyDown(e);
            }}
          />
        </I18nWrapper>
      );
    }

    render(<CaptureTest />);
    const input = screen.getByTestId("input") as HTMLInputElement;

    // Dirty the field
    fireEvent.change(input, { target: { value: "After" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(capturedResult).toBe(true);
  });

  it("handleKeyDown returns false on Escape when field is clean (U-063)", () => {
    const onPatch = vi.fn();
    let capturedResult: boolean | undefined;

    function CaptureTest() {
      const api = useAutosaveField({
        value: "Same",
        fieldKey: "title",
        onPatch,
      });

      return (
        <I18nWrapper>
          <input
            data-testid="input"
            type="text"
            value={api.localValue}
            onChange={(e) => api.onChange(e.target.value)}
            onKeyDown={(e) => {
              capturedResult = api.handleKeyDown(e);
            }}
          />
        </I18nWrapper>
      );
    }

    render(<CaptureTest />);
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.keyDown(input, { key: "Escape" });

    expect(capturedResult).toBe(false);
  });

  // ── Flush (modal close) ────────────────────────────────────────────────────

  it("flush cancels debounce and saves immediately", async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);

    function FlushTest() {
      const api = useAutosaveField({
        value: "Initial",
        fieldKey: "title",
        onPatch,
        debounceMs: 500,
      });

      return (
        <I18nWrapper>
          <input
            data-testid="input"
            type="text"
            value={api.localValue}
            onChange={(e) => api.onChange(e.target.value)}
            onBlur={api.onBlur}
          />
          <button data-testid="flush" onClick={api.flush}>
            Flush
          </button>
        </I18nWrapper>
      );
    }

    render(<FlushTest />);
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Flushed" } });
    fireEvent.blur(input); // starts debounce

    // Flush before debounce fires
    await act(() => fireEvent.click(screen.getByTestId("flush")));

    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ title: "Flushed" });
  });

  // ── Error + retry ──────────────────────────────────────────────────────────

  it("shows error state and allows retry (U-064)", async () => {
    const onPatch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(undefined);

    render(
      <TestField value="Start" onPatch={onPatch} debounceMs={100} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Fail" } });
    fireEvent.blur(input);

    await act(() => vi.advanceTimersByTimeAsync(150));

    // Error state visible — shows the specific error message, not the generic fallback
    expect(screen.getByText("Network error")).toBeInTheDocument();

    // Retry button
    const retryBtn = screen.getByRole("button", { name: "Réessayer" });
    expect(retryBtn).toBeInTheDocument();

    // Press retry
    await act(() => fireEvent.click(retryBtn));

    expect(onPatch).toHaveBeenCalledTimes(2);
    // Should now show "saved"
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  // ── Keystroke resets saved/error indicator to idle ─────────────────────────

  it("resets status to idle when user types after a save", async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(
      <TestField value="Old" onPatch={onPatch} debounceMs={100} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    // First save
    fireEvent.change(input, { target: { value: "New" } });
    fireEvent.blur(input);
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(screen.getByText("Enregistré")).toBeInTheDocument();

    // Type again — should go back to idle (no indicator)
    fireEvent.change(input, { target: { value: "Newer" } });
    expect(screen.queryByText("Enregistré")).not.toBeInTheDocument();
  });

  // ── Debounce window: rapid changes only persist the last value ─────────────

  it("debounces rapid changes — only the last value is persisted", async () => {
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(
      <TestField value="" onPatch={onPatch} debounceMs={300} />,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;

    // Type several characters quickly, blurring between each
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "AB" } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "ABC" } });
    fireEvent.blur(input);

    await act(() => vi.advanceTimersByTimeAsync(400));

    // Only one onPatch call, with the final value
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ title: "ABC" });
  });
});

// ── SaveIndicator component ────────────────────────────────────────────────────

describe("SaveIndicator", () => {
  it("renders nothing when status is idle", () => {
    const { container } = render(
      <I18nWrapper>
        <SaveIndicator status="idle" />
      </I18nWrapper>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows spinner and saving text when status is saving", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="saving" />
      </I18nWrapper>,
    );
    expect(screen.getByText("Enregistrement…")).toBeInTheDocument();
    expect(document.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it("shows saved text when status is saved", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="saved" />
      </I18nWrapper>,
    );
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  it("shows error with retry button when status is error", () => {
    const onRetry = vi.fn();
    render(
      <I18nWrapper>
        <SaveIndicator status="error" error="Something went wrong" onRetry={onRetry} />
      </I18nWrapper>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("shows fallback error message when no error string is provided", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="error" />
      </I18nWrapper>,
    );
    expect(screen.getByText("Erreur d'enregistrement")).toBeInTheDocument();
  });

  it("has aria-live=polite for non-error states", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="saving" />
      </I18nWrapper>,
    );
    const container = screen.getByText("Enregistrement…").closest('[aria-live]');
    expect(container?.getAttribute("aria-live")).toBe("polite");
  });

  it("has aria-live=assertive for error state", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="error" error="Oops" />
      </I18nWrapper>,
    );
    const container = screen.getByText("Oops").closest('[aria-live]');
    expect(container?.getAttribute("aria-live")).toBe("assertive");
  });

  it("has aria-atomic=true for full-region announcement", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="saving" />
      </I18nWrapper>,
    );
    const container = screen.getByText("Enregistrement…").closest('[aria-live]');
    expect(container?.getAttribute("aria-atomic")).toBe("true");
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(
      <I18nWrapper>
        <SaveIndicator status="error" error="Fail" onRetry={onRetry} />
      </I18nWrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retry button has touch target ≥ 44×44px", () => {
    render(
      <I18nWrapper>
        <SaveIndicator status="error" error="Fail" onRetry={vi.fn()} />
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Réessayer" });
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.className).toContain("min-w-[44px]");
  });
});

// ── AutosaveField component ────────────────────────────────────────────────────

describe("AutosaveField", () => {
  it("renders with label and default text input", () => {
    const onPatch = vi.fn();
    render(
      <I18nWrapper>
        <AutosaveField
          id="test-title"
          label="Titre"
          value="Hello"
          fieldKey="title"
          onPatch={onPatch}
        />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("Titre") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Hello");
  });

  it("auto-generates id when not provided", () => {
    const onPatch = vi.fn();
    render(
      <I18nWrapper>
        <AutosaveField
          label="Name"
          value=""
          fieldKey="name"
          onPatch={onPatch}
        />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("id");
    expect(input.id).toBeTruthy();
  });

  it("calls onPatch after blur + debounce on default input", async () => {
    vi.useRealTimers(); // need real timers for this test
    const onPatch = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nWrapper>
        <AutosaveField
          id="field"
          label="Field"
          value="Before"
          fieldKey="title"
          onPatch={onPatch}
          debounceMs={50}
        />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("Field") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "After" } });
    fireEvent.blur(input);

    // Wait for debounce
    await act(() => new Promise((r) => setTimeout(r, 100)));

    expect(onPatch).toHaveBeenCalledWith({ title: "After" });
    vi.useFakeTimers(); // restore for other tests
  });

  it("restores snapshot on Escape via default input", () => {
    const onPatch = vi.fn();
    render(
      <I18nWrapper>
        <AutosaveField
          id="field"
          label="Field"
          value="Original"
          fieldKey="title"
          onPatch={onPatch}
        />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("Field") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Modified" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("Original");
  });

  it("supports custom renderInput for headless integration (TagEditor slot)", async () => {
    vi.useRealTimers();
    const onPatch = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nWrapper>
        <AutosaveField
          id="custom"
          label="Tags"
          value="initial"
          fieldKey="tags"
          onPatch={onPatch}
          debounceMs={50}
          renderInput={(api) => (
            <textarea
              id={api.inputId}
              data-testid="custom-editor"
              value={api.localValue}
              onChange={(e) => api.onChange(e.target.value)}
              onBlur={api.onBlur}
              onKeyDown={api.handleKeyDown}
            />
          )}
        />
      </I18nWrapper>,
    );

    const editor = screen.getByTestId("custom-editor") as HTMLTextAreaElement;
    expect(editor).toBeInTheDocument();
    expect(editor.value).toBe("initial");

    fireEvent.change(editor, { target: { value: "updated" } });
    fireEvent.blur(editor);

    await act(() => new Promise((r) => setTimeout(r, 100)));

    expect(onPatch).toHaveBeenCalledWith({ tags: "updated" });
    vi.useFakeTimers();
  });

  it("shows SaveIndicator next to the label", async () => {
    vi.useRealTimers();
    const onPatch = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nWrapper>
        <AutosaveField
          id="indicator-test"
          label="Test"
          value="val"
          fieldKey="title"
          onPatch={onPatch}
          debounceMs={50}
        />
      </I18nWrapper>,
    );

    const input = screen.getByLabelText("Test") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "new val" } });
    fireEvent.blur(input);

    await act(() => new Promise((r) => setTimeout(r, 100)));

    expect(screen.getByText("Enregistré")).toBeInTheDocument();
    vi.useFakeTimers();
  });
});
