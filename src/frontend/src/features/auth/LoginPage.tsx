import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";

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
      const resp = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
    <div className="mx-auto max-w-sm space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t("auth.login")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="login-email">
            {t("auth.email")}
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="login-password">
            {t("auth.password")}
          </label>
          <input
            id="login-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner /> : t("auth.loginButton")}
        </Button>
      </form>
      <div className="text-center text-sm space-y-1">
        <p>
          <Link to="/register" className="text-blue-600 hover:underline">
            {t("auth.register")}
          </Link>
        </p>
        <p>
          <Link
            to="/forgot-password"
            className="text-blue-600 hover:underline"
          >
            {t("auth.forgotPassword")}
          </Link>
        </p>
      </div>
    </div>
  );
}
