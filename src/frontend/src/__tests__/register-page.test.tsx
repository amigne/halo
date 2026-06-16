import { type ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18next } from "@/shared/i18n";
import { RegisterPage } from "@/features/auth/RegisterPage";

// ── Helpers ────────────────────────────────────────────────────────────────────

function I18nWrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}

// ── Mock apiMutate ─────────────────────────────────────────────────────────────

const mockApiMutate = vi.fn();

vi.mock("@/shared/api/fetch-wrapper", () => ({
  apiMutate: (...args: unknown[]) => mockApiMutate(...args),
}));

// ── Mock Link (TanStack Router context not available in Vitest) ───────────────

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// RegisterPage imports Link from @tanstack/react-router — we don't need routing
// in these tests, but the component renders anyway.

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("RegisterPage", () => {
  it("shows password mismatch message inline, disables button, and does not call API", async () => {
    render(
      <I18nWrapper>
        <RegisterPage />
      </I18nWrapper>,
    );

    // Fill required fields
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const firstNameInput = screen.getByLabelText("Prénom") as HTMLInputElement;
    const lastNameInput = screen.getByLabelText("Nom") as HTMLInputElement;
    const passwordInput = screen.getByLabelText(
      "Mot de passe",
    ) as HTMLInputElement;
    const confirmInput = screen.getByLabelText(
      "Confirmer le mot de passe",
    ) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "test@test.com" } });
    fireEvent.change(firstNameInput, { target: { value: "Alice" } });
    fireEvent.change(lastNameInput, { target: { value: "Dupont" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.change(confirmInput, { target: { value: "different" } });

    // Mismatch message visible inline under confirm field
    expect(
      screen.getByText("Les mots de passe ne correspondent pas"),
    ).toBeInTheDocument();

    // Confirm field has error styling
    expect(confirmInput.getAttribute("aria-invalid")).toBe("true");
    expect(confirmInput.className).toContain("border-danger");

    // Submit button is disabled
    const submitBtn = screen.getByRole("button", {
      name: "Créer un compte",
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Try submitting anyway — form validation prevents, no API call
    fireEvent.click(submitBtn);
    expect(mockApiMutate).not.toHaveBeenCalled();
  });

  it("submits correct payload (without confirm) when passwords match", async () => {
    mockApiMutate.mockResolvedValue({ ok: true });

    render(
      <I18nWrapper>
        <RegisterPage />
      </I18nWrapper>,
    );

    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    const firstNameInput = screen.getByLabelText("Prénom") as HTMLInputElement;
    const lastNameInput = screen.getByLabelText("Nom") as HTMLInputElement;
    const passwordInput = screen.getByLabelText(
      "Mot de passe",
    ) as HTMLInputElement;
    const confirmInput = screen.getByLabelText(
      "Confirmer le mot de passe",
    ) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "test@test.com" } });
    fireEvent.change(firstNameInput, { target: { value: "Alice" } });
    fireEvent.change(lastNameInput, { target: { value: "Dupont" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.change(confirmInput, { target: { value: "secret123" } });

    // No mismatch message
    expect(
      screen.queryByText("Les mots de passe ne correspondent pas"),
    ).not.toBeInTheDocument();

    // Button is enabled
    const submitBtn = screen.getByRole("button", {
      name: "Créer un compte",
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    // Submit
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockApiMutate).toHaveBeenCalledTimes(1);
    });

    // Payload has no confirm field
    const [url, options] = mockApiMutate.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(url).toBe("/api/v1/auth/register");
    expect(options.body).toEqual({
      email: "test@test.com",
      password: "secret123",
      first_name: "Alice",
      last_name: "Dupont",
    });
    expect(options.body).not.toHaveProperty("confirm");
  });

  it("shows password hint text", () => {
    render(
      <I18nWrapper>
        <RegisterPage />
      </I18nWrapper>,
    );

    expect(
      screen.getByText("Au moins 8 caractères."),
    ).toBeInTheDocument();
  });

  it("disables button when password is empty", () => {
    render(
      <I18nWrapper>
        <RegisterPage />
      </I18nWrapper>,
    );

    const submitBtn = screen.getByRole("button", {
      name: "Créer un compte",
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("does not show mismatch when confirm field is empty", () => {
    render(
      <I18nWrapper>
        <RegisterPage />
      </I18nWrapper>,
    );

    const passwordInput = screen.getByLabelText(
      "Mot de passe",
    ) as HTMLInputElement;

    fireEvent.change(passwordInput, { target: { value: "secret123" } });

    // Mismatch is only computed when confirm has content
    expect(
      screen.queryByText("Les mots de passe ne correspondent pas"),
    ).not.toBeInTheDocument();
  });
});
