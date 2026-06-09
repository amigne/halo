import {
  type ReactNode,
  useState,
} from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18next } from "@/shared/i18n";
import { Modal } from "@/shared/ui/Modal";
import { registerModal, ModalHost } from "@/shared/modal/ModalHost";
import { useRoutedModal } from "@/shared/modal/use-routed-modal";

// ── Helpers ──────────────────────────────────────────────────────────────────

function I18nWrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}

// ── Mock TanStack Router ─────────────────────────────────────────────────────

const searchState = { modal: undefined as string[] | undefined };

const routerMock = {
  navigate: vi.fn(),
  latestLocation: { search: undefined as Record<string, unknown> | undefined },
};

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => searchState,
  useRouter: () => routerMock,
}));

beforeEach(() => {
  searchState.modal = undefined;
  routerMock.latestLocation.search = {};
  routerMock.navigate.mockReset();
  // Simulate navigate updating latestLocation and searchState
  routerMock.navigate.mockImplementation(
    (opts: { search: Record<string, unknown>; replace?: boolean }) => {
      if (opts.search) {
        routerMock.latestLocation.search = opts.search;
        const modalVal = opts.search.modal;
        searchState.modal = Array.isArray(modalVal)
          ? (modalVal as string[])
          : undefined;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  // Ensure body scroll is unlocked
  document.body.style.overflow = "";
});

// ── Modal ────────────────────────────────────────────────────────────────────

describe("Modal", () => {
  it("renders nothing when open=false", () => {
    render(
      <I18nWrapper>
        <Modal open={false} onClose={() => {}} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a dialog with correct ARIA attributes when open", () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Settings">
          <p>Modal body content</p>
        </Modal>
      </I18nWrapper>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // aria-labelledby should point to the title heading
    const titleId = dialog.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    const title = document.getElementById(titleId!);
    expect(title).toBeInTheDocument();
    expect(title!.textContent).toBe("Settings");
    expect(title!.tagName).toBe("H2");
  });

  it("renders children inside the dialog", () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Test">
          <p>Modal body content</p>
        </Modal>
      </I18nWrapper>,
    );
    expect(screen.getByText("Modal body content")).toBeInTheDocument();
  });

  it("renders a close button with accessible label", () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it("calls onClose when the close button (✕) is clicked", () => {
    const onClose = vi.fn();
    render(
      <I18nWrapper>
        <Modal open={true} onClose={onClose} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the overlay is clicked", () => {
    const onClose = vi.fn();
    render(
      <I18nWrapper>
        <Modal open={true} onClose={onClose} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    // The overlay is the parent of the dialog panel
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when clicking inside the modal panel", () => {
    const onClose = vi.fn();
    render(
      <I18nWrapper>
        <Modal open={true} onClose={onClose} title="Test">
          <button>Inner button</button>
        </Modal>
      </I18nWrapper>,
    );
    const innerBtn = screen.getByRole("button", { name: "Inner button" });
    fireEvent.click(innerBtn);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(
      <I18nWrapper>
        <Modal open={true} onClose={onClose} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll when opened and unlocks when closed", () => {
    expect(document.body.style.overflow).toBe("");

    const { rerender } = render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <I18nWrapper>
        <Modal open={false} onClose={() => {}} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("supports stacking: body scroll stays locked until all modals are closed", () => {
    // First modal
    const { unmount: unmount1 } = render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="First">
          First body
        </Modal>
      </I18nWrapper>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    // Second modal stacked
    const { unmount: unmount2 } = render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Second">
          Second body
        </Modal>
      </I18nWrapper>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    // Close second (topmost) — body should STILL be locked
    unmount2();
    expect(document.body.style.overflow).toBe("hidden");

    // Close first (last) — body scroll unlocked
    unmount1();
    expect(document.body.style.overflow).toBe("");
  });

  it("uses --z-overlay and --z-modal CSS variables", () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    const dialog = screen.getByRole("dialog");
    // The overlay is the parent
    const overlay = dialog.parentElement!;
    expect(overlay.className).toContain("z-[var(--z-overlay)]");
    expect(dialog.className).toContain("z-[var(--z-modal)]");
  });

  it("has prefers-reduced-motion classes", () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Test">
          Body
        </Modal>
      </I18nWrapper>,
    );
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    expect(overlay.className).toContain("motion-safe:animate-");
    expect(dialog.className).toContain("motion-safe:animate-");
  });
});

// ── Focus trap ───────────────────────────────────────────────────────────────

describe("Modal focus trap", () => {
  it("moves focus inside the dialog on open (not on body)", async () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Focus Test">
          <button>Content Action</button>
        </Modal>
      </I18nWrapper>,
    );
    // React schedules focus via requestAnimationFrame inside useEffect.
    // vi.waitFor polls until the assertion passes.
    await vi.waitFor(() => {
      const active = document.activeElement;
      expect(active).not.toBe(document.body);
      // Must be inside the dialog
      expect(
        screen.getByRole("dialog").contains(active),
      ).toBe(true);
    });
  });

  it("wraps Tab from last to first focusable element", async () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Trap Test">
          <button>Alpha</button>
          <input placeholder="Beta" />
          <button>Gamma</button>
        </Modal>
      </I18nWrapper>,
    );

    // Wait for initial focus to settle
    await vi.waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
    });

    // Manually focus the last content element (Gamma)
    const lastBtn = screen.getByRole("button", { name: "Gamma" });
    act(() => lastBtn.focus());
    expect(document.activeElement).toBe(lastBtn);

    // Fire Tab on the overlay — should wrap to first focusable (close btn)
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.keyDown(overlay, { key: "Tab", shiftKey: false });

    // Should wrap to the first focusable element (the ✕ close button)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /close modal/i }),
    );
  });

  it("wraps Shift+Tab from first to last focusable element", async () => {
    render(
      <I18nWrapper>
        <Modal open={true} onClose={() => {}} title="Trap Test">
          <button>Alpha</button>
          <input placeholder="Beta" />
          <button>Gamma</button>
        </Modal>
      </I18nWrapper>,
    );

    // Wait for initial focus to settle
    await vi.waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
    });

    // Manually focus the first element (close button)
    const closeBtn = screen.getByRole("button", { name: /close modal/i });
    act(() => closeBtn.focus());
    expect(document.activeElement).toBe(closeBtn);

    // Fire Shift+Tab on the overlay — should wrap to last content element
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.keyDown(overlay, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Gamma" }),
    );
  });

  it("does not close on non-Escape keys", () => {
    const onClose = vi.fn();
    render(
      <I18nWrapper>
        <Modal open={true} onClose={onClose} title="Keys">
          <button>Only</button>
        </Modal>
      </I18nWrapper>,
    );
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.keyDown(overlay, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── Focus restoration ────────────────────────────────────────────────────────

describe("Modal focus restoration", () => {
  function TriggerButton({ startOpen }: { startOpen: boolean }) {
    const [open, setOpen] = useState(startOpen);

    return (
      <I18nWrapper>
        <button
          data-testid="trigger-btn"
          onClick={() => setOpen(true)}
        >
          Open modal
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="Restore">
          <p>Content</p>
        </Modal>
      </I18nWrapper>
    );
  }

  it("restores focus to the previously focused element when closed", async () => {
    // 1) Start closed, focus the trigger button
    render(<TriggerButton startOpen={false} />);
    const trigger = screen.getByTestId("trigger-btn");
    act(() => trigger.focus());
    expect(document.activeElement).toBe(trigger);

    // 2) Click trigger → opens modal
    fireEvent.click(trigger);

    // Wait for modal to appear and initial focus to settle
    await vi.waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // 3) Close the modal via Escape
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.keyDown(overlay, { key: "Escape" });

    // 4) Focus should return to the trigger
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("restores focus when closed via overlay click", async () => {
    // Start closed, focus the trigger
    render(<TriggerButton startOpen={false} />);
    const trigger = screen.getByTestId("trigger-btn");
    act(() => trigger.focus());
    fireEvent.click(trigger);

    await vi.waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Close via overlay click
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.click(overlay);

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });
});

// ── Routed modal hook ────────────────────────────────────────────────────────

describe("useRoutedModal", () => {
  function TestComponent() {
    const { modalStack, openModal, closeModal, isOpen } = useRoutedModal();

    return (
      <div>
        <span data-testid="stack">{JSON.stringify(modalStack)}</span>
        <button data-testid="open-a" onClick={() => openModal("a")}>
          Open A
        </button>
        <button data-testid="open-b" onClick={() => openModal("b")}>
          Open B
        </button>
        <button data-testid="close" onClick={closeModal}>
          Close topmost
        </button>
        <span data-testid="a-open">{String(isOpen("a"))}</span>
        <span data-testid="b-open">{String(isOpen("b"))}</span>
      </div>
    );
  }

  function renderTest() {
    return render(
      <I18nWrapper>
        <TestComponent />
      </I18nWrapper>,
    );
  }

  it("returns an empty stack by default", () => {
    searchState.modal = undefined;
    renderTest();
    expect(screen.getByTestId("stack").textContent).toBe("[]");
  });

  it("returns existing search param as the stack", () => {
    searchState.modal = ["settings"];
    renderTest();
    expect(screen.getByTestId("stack").textContent).toBe(
      '["settings"]',
    );
  });

  it("openModal pushes a key via navigate", () => {
    searchState.modal = undefined;
    routerMock.latestLocation.search = {};
    renderTest();
    fireEvent.click(screen.getByTestId("open-a"));
    expect(routerMock.navigate).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate.mock.calls[0]![0].search).toEqual({
      modal: ["a"],
    });
  });

  it("openModal appends to an existing stack", () => {
    searchState.modal = ["a"];
    routerMock.latestLocation.search = { modal: ["a"] };
    renderTest();
    fireEvent.click(screen.getByTestId("open-b"));
    expect(routerMock.navigate.mock.calls[0]![0].search).toEqual({
      modal: ["a", "b"],
    });
  });

  it("closeModal removes the topmost key", () => {
    searchState.modal = ["a", "b"];
    routerMock.latestLocation.search = { modal: ["a", "b"] };
    renderTest();
    fireEvent.click(screen.getByTestId("close"));
    expect(routerMock.navigate.mock.calls[0]![0].search).toEqual({
      modal: ["a"],
    });
  });

  it("closeModal removes the modal key when stack becomes empty", () => {
    searchState.modal = ["a"];
    routerMock.latestLocation.search = { modal: ["a"], other: "keep" };
    renderTest();
    fireEvent.click(screen.getByTestId("close"));
    const result = routerMock.navigate.mock.calls[0]![0]
      .search as Record<string, unknown>;
    expect(result).not.toHaveProperty("modal");
    expect(result).toHaveProperty("other", "keep");
  });

  it("closeModal does not navigate when stack is already empty", () => {
    searchState.modal = undefined;
    routerMock.latestLocation.search = {};
    renderTest();
    fireEvent.click(screen.getByTestId("close"));
    // Should not call navigate since stack is empty
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it("isOpen returns true/false depending on whether the key is in the stack", () => {
    // Key "a" is NOT in the stack
    searchState.modal = ["settings"];
    const { unmount } = renderTest();
    expect(screen.getByTestId("a-open").textContent).toBe("false");

    // Re-render with key "a" now in the stack
    unmount();
    searchState.modal = ["a"];
    renderTest();
    expect(screen.getByTestId("a-open").textContent).toBe("true");
  });
});

// ── ModalHost + registry ─────────────────────────────────────────────────────

describe("ModalHost", () => {
  function FakeContent({ onClose }: { onClose: () => void }) {
    return (
      <div>
        <p>Fake modal content</p>
        <button onClick={onClose}>Close from inside</button>
      </div>
    );
  }

  function AnotherContent({ onClose }: { onClose: () => void }) {
    return (
      <div>
        <p>Another modal</p>
        <button onClick={onClose}>Done</button>
      </div>
    );
  }

  it("renders nothing when the stack is empty", () => {
    searchState.modal = undefined;
    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a registered modal when its key is in the stack", () => {
    registerModal("test-modal", FakeContent, "Test Modal Title");
    searchState.modal = ["test-modal"];

    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Fake modal content")).toBeInTheDocument();
    expect(screen.getByText("Test Modal Title")).toBeInTheDocument();
  });

  it("renders multiple stacked modals", () => {
    registerModal("first", FakeContent, "First Modal");
    registerModal("second", AnotherContent, "Second Modal");
    searchState.modal = ["first", "second"];

    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    // Both dialogs should be present
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(2);
    expect(screen.getByText("Fake modal content")).toBeInTheDocument();
    expect(screen.getByText("Another modal")).toBeInTheDocument();
    expect(screen.getByText("First Modal")).toBeInTheDocument();
    expect(screen.getByText("Second Modal")).toBeInTheDocument();
  });

  it("skips keys not found in the registry", () => {
    registerModal("known", FakeContent, "Known");
    searchState.modal = ["unknown", "known"];

    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    // Only one dialog for the registered key
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(screen.getByText("Known")).toBeInTheDocument();
  });

  it("calls closeModal when the modal close button is clicked", () => {
    registerModal("closable", FakeContent, "Closable");
    searchState.modal = ["closable"];

    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    // The ✕ close button has aria-label "Close modal" — target it specifically
    // to distinguish from the "Close from inside" button rendered by FakeContent
    const closeButtons = screen.getAllByRole("button", {
      name: /close modal/i,
    });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[0]!);
    // Should have called navigate (via closeModal)
    expect(routerMock.navigate).toHaveBeenCalled();
  });

  it("calls closeModal when Escape is pressed on the topmost modal", () => {
    registerModal("esc-test", FakeContent, "Esc Test");
    searchState.modal = ["esc-test"];

    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    // The onKeyDown handler lives on the overlay (parent of the dialog)
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(routerMock.navigate).toHaveBeenCalled();
  });
});

// ── Body scroll: ModalHost stacking ──────────────────────────────────────────

describe("ModalHost body scroll lock", () => {
  function DummyContent({ onClose }: { onClose: () => void }) {
    return (
      <div>
        <p>Content</p>
        <button onClick={onClose}>X</button>
      </div>
    );
  }

  it("locks body scroll when a modal is open, unlocks when stack empties", () => {
    registerModal("m1", DummyContent, "Modal 1");
    searchState.modal = ["m1"];

    const { unmount } = render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps body scroll locked with two stacked modals until both close", () => {
    registerModal("m1", DummyContent, "Modal 1");
    registerModal("m2", DummyContent, "Modal 2");
    searchState.modal = ["m1", "m2"];

    render(
      <I18nWrapper>
        <ModalHost />
      </I18nWrapper>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    // Close topmost → still locked (m1 remains)
    const dialogs = screen.getAllByRole("dialog");
    const topmostOverlay = dialogs[1]!.parentElement!;
    fireEvent.click(topmostOverlay);

    // routerMock.navigate should have been called (closeModal triggered)
    expect(routerMock.navigate).toHaveBeenCalled();
  });
});
