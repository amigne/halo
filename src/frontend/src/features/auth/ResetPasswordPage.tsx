import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Spinner } from "@/shared/ui/Spinner";
import { apiMutate } from "@/shared/api/fetch-wrapper";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/reset-password" }) as { token?: string };
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
      const resp = await apiMutate("/api/v1/auth/reset-password", {
        body: { token, password },
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
      <div className="text-center">
        <p>{t("auth.invalidLink")}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold text-success">
          {t("auth.passwordReset")}
        </h2>
        <p className="text-text-muted">{t("auth.passwordResetMessage")}</p>
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t("auth.setNewPassword")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="rp-password"
          label={t("auth.newPassword")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          id="rp-confirm"
          label={t("auth.confirmPassword")}
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner /> : t("auth.setNewPassword")}
        </Button>
      </form>
    </>
  );
}
