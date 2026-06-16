import { type ReactNode } from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18next } from "@/shared/i18n";
import { ListItemForm } from "@/features/lists/components/ListItemForm";
import type { ListItemResponse } from "@/features/lists/api";
import * as api from "@/features/lists/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Wraps components with i18next + QueryClient. */
function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18next}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/features/lists/api", () => ({
  updateItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/ui/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const fullItem: ListItemResponse = {
  id: "item-1",
  list_id: "list-1",
  title: "Buy groceries",
  description: "Milk, eggs, bread",
  is_done: false,
  priority: 2, // High
  due_at: "2027-01-15T18:00:00Z",
  notify_before: 30,
  assignee_user_id: null,
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const fullSchema = [
  { key: "is_done", type: "checkbox" },
  { key: "title", type: "text" },
  { key: "description", type: "text" },
  { key: "priority", type: "select" },
  { key: "due_at", type: "datetime" },
  { key: "notify_before", type: "number" },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ListItemForm — read mode", () => {
  it("renders title as text with chips, no form inputs visible", () => {
    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    // Title is text, not an input
    expect(screen.getByText("Buy groceries")).toBeInTheDocument();

    // Priority chip visible ("Haute" in French default locale)
    expect(screen.getByText("Haute")).toBeInTheDocument();

    // Due date chip visible (month format depends on locale — "janv." in fr)
    expect(screen.getByText(/janv/)).toBeInTheDocument();

    // No title input visible
    expect(screen.queryByLabelText("Titre")).not.toBeInTheDocument();

    // No description textarea visible
    expect(
      screen.queryByPlaceholderText("Description…"),
    ).not.toBeInTheDocument();
  });

  it("shows strikethrough title when item is done", () => {
    const doneItem = { ...fullItem, is_done: true };
    render(
      <Wrapper>
        <ListItemForm
          item={doneItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    const title = screen.getByText("Buy groceries");
    expect(title.className).toContain("line-through");
    expect(title.className).toContain("text-text-muted");
  });

  it("toggles is_done in read mode without entering edit mode", () => {
    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    const checkbox = screen.getByLabelText("Marquer fait");
    fireEvent.click(checkbox);

    // Should still be in read mode (no title input visible)
    expect(screen.queryByLabelText("Titre")).not.toBeInTheDocument();

    // Should have triggered PATCH for is_done
    expect(api.updateItem).toHaveBeenCalledWith("list-1", "item-1", {
      is_done: true,
    });
  });

  it("does not show priority chip when value is null", () => {
    const noPriorityItem = { ...fullItem, priority: null };
    render(
      <Wrapper>
        <ListItemForm
          item={noPriorityItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    // Priority chip should not be visible
    expect(screen.queryByText("Haute")).not.toBeInTheDocument();
    expect(screen.queryByText("Basse")).not.toBeInTheDocument();
  });

  it("does not show due date chip when value is null", () => {
    const noDueItem = { ...fullItem, due_at: null };
    render(
      <Wrapper>
        <ListItemForm
          item={noDueItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    // Due date chip should not be visible (no janv.)
    expect(screen.queryByText(/janv/)).not.toBeInTheDocument();
  });
});

describe("ListItemForm — edit mode", () => {
  it("enters edit mode on row click and mounts editable fields", () => {
    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    // Click the row (the title text) to enter edit mode
    fireEvent.click(screen.getByText("Buy groceries"));

    // Title input should now be visible
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();

    // Priority select should be visible
    expect(screen.getByLabelText("Priorité")).toBeInTheDocument();

    // "Done editing" button should be visible
    expect(screen.getByLabelText("Terminé")).toBeInTheDocument();
  });

  it("enters edit mode on pencil click", () => {
    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByLabelText("Modifier"));

    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
  });

  it("triggers PATCH on blur of title field (autosave)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    // Enter edit mode via row click
    fireEvent.click(screen.getByText("Buy groceries"));

    const titleInput = screen.getByLabelText("Titre") as HTMLInputElement;
    // Change the value
    fireEvent.change(titleInput, { target: { value: "Updated groceries" } });

    // Advance past autosave debounce (500ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Trigger blur
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(api.updateItem).toHaveBeenCalledWith("list-1", "item-1", {
        title: "Updated groceries",
      });
    });

    vi.useRealTimers();
  });

  it("returns to read mode on 'Done editing' button click", () => {
    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={vi.fn()}
        />
      </Wrapper>,
    );

    // Enter edit mode
    fireEvent.click(screen.getByText("Buy groceries"));
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();

    // Click "Done editing"
    fireEvent.click(screen.getByLabelText("Terminé"));

    // Back in read mode
    expect(screen.queryByLabelText("Titre")).not.toBeInTheDocument();
    expect(screen.getByText("Buy groceries")).toBeInTheDocument();
  });
});

describe("ListItemForm — delete", () => {
  it("calls deleteItem and onDeleted when trash button is clicked", async () => {
    const onDeleted = vi.fn();

    render(
      <Wrapper>
        <ListItemForm
          item={fullItem}
          listId="list-1"
          fieldSchema={fullSchema}
          timezone="UTC"
          onDeleted={onDeleted}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByLabelText("Supprimer l'élément"));

    expect(api.deleteItem).toHaveBeenCalledWith("list-1", "item-1");
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
