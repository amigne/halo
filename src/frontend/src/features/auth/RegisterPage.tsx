import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";
import { apiMutate } from "@/shared/api/fetch-wrapper";

export function RegisterPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const resp = await apiMutate("/api/v1/auth/register", {
        body: { email, password, first_name: firstName, last_name: lastName },
      });

      if (!resp.ok) {
        const data = await resp.json();
        setError(data.detail?.message ?? t("auth.error"));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-4 text-center">
        <h1 className="text-2xl font-bold">{t("auth.checkEmail")}</h1>
        <p className="text-muted">{t("auth.checkEmailMessage")}</p>
        <Link to="/login" className="text-blue-600 hover:underline">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t("auth.register")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="reg-email">
            {t("auth.email")}
          </label>
          <input
            id="reg-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="reg-firstname">
            {t("auth.firstName")}
          </label>
          <input
            id="reg-firstname"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="reg-lastname">
            {t("auth.lastName")}
          </label>
          <input
            id="reg-lastname"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="reg-password">
            {t("auth.password")}
          </label>
          <input
            id="reg-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
          <p className="mt-1 text-xs text-text-muted">
            {t("auth.passwordHint")}
          </p>
        </div>
        <div>
          <label
            className="block text-sm font-medium"
            htmlFor="reg-password-confirm"
          >
            {t("auth.confirmPassword")}
          </label>
          <input
            id="reg-password-confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || undefined}
            aria-describedby={
              mismatch ? "reg-password-confirm-err" : undefined
            }
            className={`w-full rounded border bg-surface px-3 py-2 ${
              mismatch ? "border-danger" : "border-border"
            }`}
          />
          {mismatch && (
            <p
              id="reg-password-confirm-err"
              className="mt-1 text-sm text-danger"
            >
              {t("auth.passwordMismatch")}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          type="submit"
          disabled={loading || mismatch || !password || !confirm}
          className="w-full"
        >
          {loading ? <Spinner /> : t("auth.registerButton")}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link to="/login" className="text-blue-600 hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
