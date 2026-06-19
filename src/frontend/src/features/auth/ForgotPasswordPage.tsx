import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
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
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold">{t("auth.checkEmail")}</h2>
        <p className="text-text-muted">{t("auth.resetEmailSent")}</p>
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t("auth.forgotPassword")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="fp-email"
          label={t("auth.email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner /> : t("auth.sendResetLink")}
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
