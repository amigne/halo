import { type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18next } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Toggle } from "@/shared/ui/Toggle";
import { Tabs } from "@/shared/ui/Tabs";
import type { TabItem } from "@/shared/ui/Tabs";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Wraps a component in the I18nextProvider. */
function I18nWrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}

// ── Button ─────────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders with default variant (primary)", () => {
    render(
      <I18nWrapper>
        <Button>Click me</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("text-primary-contrast");
  });

  it("renders secondary variant with correct tokens", () => {
    render(
      <I18nWrapper>
        <Button variant="secondary">Secondary</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Secondary" });
    expect(btn.className).toContain("bg-surface");
    expect(btn.className).toContain("border-border");
  });

  it("renders danger variant with correct tokens", () => {
    render(
      <I18nWrapper>
        <Button variant="danger">Delete</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).toContain("bg-danger");
  });

  it("renders ghost variant with correct tokens", () => {
    render(
      <I18nWrapper>
        <Button variant="ghost">Cancel</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Cancel" });
    expect(btn.className).toContain("text-text-muted");
    expect(btn.className).toContain("hover:bg-bg");
  });

  it("displays Spinner and sets aria-busy when loading", () => {
    render(
      <I18nWrapper>
        <Button loading>Saving</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    // Spinner should be rendered
    expect(document.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    render(
      <I18nWrapper>
        <Button disabled>Nope</Button>
      </I18nWrapper>,
    );
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });

  it("has touch target ≥ 44px on coarse pointers only (U-014)", () => {
    render(
      <I18nWrapper>
        <Button>Touch</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Touch" });
    // min-height ≥ 44px applies only on coarse (touch) pointers
    expect(btn.className).toContain("[@media(pointer:coarse)]:min-h-11");
  });

  it("has focus-visible ring class", () => {
    render(
      <I18nWrapper>
        <Button>Focus</Button>
      </I18nWrapper>,
    );
    const btn = screen.getByRole("button", { name: "Focus" });
    expect(btn.className).toContain("focus-visible:ring-focus-ring");
  });

  it("passes through native button props (type)", () => {
    render(
      <I18nWrapper>
        <Button type="submit">Submit</Button>
      </I18nWrapper>,
    );
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});

// ── Input ──────────────────────────────────────────────────────────────────────

describe("Input", () => {
  it("renders with label associated via htmlFor/id", () => {
    render(
      <I18nWrapper>
        <Input id="email" label="Email" />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "email");
  });

  it("auto-generates id when not provided", () => {
    render(
      <I18nWrapper>
        <Input label="Name" />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("id");
    expect(input.id).toBeTruthy();
  });

  it("displays error message with role=alert", () => {
    render(
      <I18nWrapper>
        <Input id="x" label="X" error="This field is required" />
      </I18nWrapper>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This field is required",
    );
  });

  it("sets aria-invalid and aria-describedby when error is present", () => {
    render(
      <I18nWrapper>
        <Input id="x" label="X" error="Bad value" />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("X");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("x-error");
  });

  it("does not set aria-invalid when no error", () => {
    render(
      <I18nWrapper>
        <Input id="x" label="X" />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("X");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("calls onChange on input", () => {
    const onChange = vi.fn();
    render(
      <I18nWrapper>
        <Input id="x" label="X" onChange={onChange} />
      </I18nWrapper>,
    );
    fireEvent.change(screen.getByLabelText("X"), {
      target: { value: "hello" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("has error border class when error is present", () => {
    render(
      <I18nWrapper>
        <Input id="x" label="X" error="Oops" />
      </I18nWrapper>,
    );
    expect(screen.getByLabelText("X").className).toContain("border-danger");
  });

  it("passes through native props (placeholder, disabled)", () => {
    render(
      <I18nWrapper>
        <Input id="x" label="X" placeholder="Enter value" disabled />
      </I18nWrapper>,
    );
    const input = screen.getByLabelText("X");
    expect(input).toHaveAttribute("placeholder", "Enter value");
    expect(input).toBeDisabled();
  });
});

// ── Toggle ─────────────────────────────────────────────────────────────────────

describe("Toggle", () => {
  it("has role=switch and aria-checked", () => {
    render(
      <I18nWrapper>
        <Toggle
          id="t1"
          label="Notifications"
          checked={true}
          onChange={() => {}}
        />
      </I18nWrapper>,
    );
    const sw = screen.getByRole("switch", { name: "Notifications" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("renders aria-checked=false when off", () => {
    render(
      <I18nWrapper>
        <Toggle
          id="t2"
          label="Sound"
          checked={false}
          onChange={() => {}}
        />
      </I18nWrapper>,
    );
    const sw = screen.getByRole("switch", { name: "Sound" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("calls onChange with toggled value on click", () => {
    const onChange = vi.fn();
    render(
      <I18nWrapper>
        <Toggle
          id="t3"
          label="Toggle me"
          checked={false}
          onChange={onChange}
        />
      </I18nWrapper>,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Toggle me" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("label is clickable via htmlFor", () => {
    render(
      <I18nWrapper>
        <Toggle
          id="t4"
          label="Click label"
          checked={false}
          onChange={() => {}}
        />
      </I18nWrapper>,
    );
    // The label element exists and has htmlFor
    const label = document.querySelector("label[for='t4']");
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent("Click label");
  });

  it("is disabled when disabled prop is set", () => {
    render(
      <I18nWrapper>
        <Toggle
          id="t5"
          label="Locked"
          checked={false}
          onChange={() => {}}
          disabled
        />
      </I18nWrapper>,
    );
    expect(screen.getByRole("switch", { name: "Locked" })).toBeDisabled();
  });

  it("has focus-visible ring class", () => {
    render(
      <I18nWrapper>
        <Toggle
          id="t6"
          label="Focus"
          checked={false}
          onChange={() => {}}
        />
      </I18nWrapper>,
    );
    const sw = screen.getByRole("switch", { name: "Focus" });
    expect(sw.className).toContain("focus-visible:ring-focus-ring");
  });
});

// ── Tabs ───────────────────────────────────────────────────────────────────────

function TestTabs({ onChange }: { onChange?: (id: string) => void }) {
  const tabItems: TabItem[] = [
    { id: "tab1", label: "General", content: <p>General content</p> },
    { id: "tab2", label: "Settings", content: <p>Settings content</p> },
    { id: "tab3", label: "About", content: <p>About content</p> },
  ];
  return (
    <I18nWrapper>
      <Tabs tabs={tabItems} onChange={onChange} />
    </I18nWrapper>
  );
}

describe("Tabs", () => {
  it("renders all tab buttons with role=tab", () => {
    render(<TestTabs />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("first tab is selected by default", () => {
    render(<TestTabs />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("false");
  });

  it("renders active tab panel content", () => {
    render(<TestTabs />);
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByText("General content")).toBeInTheDocument();
  });

  it("changes active tab on click", () => {
    render(<TestTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText("Settings content")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
  });

  it("supports arrow key navigation", () => {
    render(<TestTabs />);
    const tabs = screen.getAllByRole("tab");
    tabs[0]!.focus();

    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    // After ArrowRight, the second tab should be selected (focus moves)
    expect(screen.getByText("Settings content")).toBeInTheDocument();
  });

  it("calls onChange when tab changes", () => {
    const onChange = vi.fn();
    render(<TestTabs onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "About" }));
    expect(onChange).toHaveBeenCalledWith("tab3");
  });

  it("has accessible tablist, tabpanel structure", () => {
    render(<TestTabs />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("active tab has aria-controls pointing to the panel", () => {
    render(<TestTabs />);
    const activeTab = screen.getByRole("tab", { name: "General" });
    const panel = screen.getByRole("tabpanel");
    expect(activeTab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(activeTab.id);
  });
});
