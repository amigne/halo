import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Spinner } from "@/shared/ui/Spinner";
import { apiMutate } from "@/shared/api/fetch-wrapper";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resp = await apiMutate("/api/v1/auth/login", {
        body: { email, password },
      });

      if (!resp.ok) {
        const data = await resp.json();
        setError(data.detail?.message ?? t("auth.error"));
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["auth"] });
      await navigate({ to: "/" });
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t("auth.login")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="login-email"
          label={t("auth.email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="login-password"
          label={t("auth.password")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner /> : t("auth.loginButton")}
        </Button>
      </form>
      <div className="text-center text-sm space-y-1">
        <p>
          <Link to="/register" className="text-primary hover:underline">
            {t("auth.register")}
          </Link>
        </p>
        <p>
          <Link to="/forgot-password" className="text-primary hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </p>
      </div>
    </>
  );
}
