import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";
import { apiMutate } from "@/shared/api/fetch-wrapper";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiMutate("/api/v1/auth/forgot-password", { body: { email } });
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-4 text-center">
        <h1 className="text-2xl font-bold">{t("auth.checkEmail")}</h1>
        <p>{t("auth.resetEmailSent")}</p>
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t("auth.forgotPassword")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="fp-email">
            {t("auth.email")}
          </label>
          <input
            id="fp-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner /> : t("auth.sendResetLink")}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
