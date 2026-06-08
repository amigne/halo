import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/reset-password" }) as { token?: string };
  const token = search.token ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordMinLength"));
      return;
    }

    setLoading(true);
    try {
      await fetch("/api/v1/auth/csrf");
      const csrfToken =
        document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.at(1) ?? "";
      const resp = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ token, password }),
      });
      const data = await resp.json();
      if (
        typeof data.message === "string" &&
        data.message.toLowerCase().includes("success")
      ) {
        setDone(true);
      } else {
        setError(data.message ?? t("auth.invalidLink"));
      }
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-4 text-center">
        <p>{t("auth.invalidLink")}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-4 text-center">
        <h1 className="text-2xl font-bold text-green-600">
          {t("auth.passwordReset")}
        </h1>
        <p>{t("auth.passwordResetMessage")}</p>
        <Link to="/login" className="text-blue-600 hover:underline">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t("auth.setNewPassword")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="rp-password">
            {t("auth.newPassword")}
          </label>
          <input
            id="rp-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="rp-confirm">
            {t("auth.confirmPassword")}
          </label>
          <input
            id="rp-confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner /> : t("auth.setNewPassword")}
        </Button>
      </form>
    </div>
  );
}
