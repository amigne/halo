import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
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
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold">{t("auth.checkEmail")}</h2>
        <p className="text-text-muted">{t("auth.checkEmailMessage")}</p>
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t("auth.register")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="reg-email"
          label={t("auth.email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="reg-firstname"
          label={t("auth.firstName")}
          type="text"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          id="reg-lastname"
          label={t("auth.lastName")}
          type="text"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="reg-password">
            {t("auth.password")}
          </label>
          <input
            id="reg-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1"
          />
          <p className="text-xs text-text-muted">{t("auth.passwordHint")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="reg-password-confirm">
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
            aria-describedby={mismatch ? "reg-password-confirm-err" : undefined}
            className={`w-full rounded-md border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 ${
              mismatch ? "border-danger" : "border-border-strong"
            }`}
          />
          {mismatch && (
            <p id="reg-password-confirm-err" role="alert" className="text-xs text-danger">
              {t("auth.passwordMismatch")}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          type="submit"
          disabled={loading || mismatch || !password || !confirm}
          className="w-full"
        >
          {loading ? <Spinner /> : t("auth.registerButton")}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </>
  );
}
