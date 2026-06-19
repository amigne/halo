import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, Link } from "@tanstack/react-router";
import { Spinner } from "@/shared/ui/Spinner";
import { Button } from "@/shared/ui/Button";
import { apiMutate } from "@/shared/api/fetch-wrapper";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/auth/verify-email" }) as { token?: string };
  const [status, setStatus] = useState<
    "loading" | "ready" | "verifying" | "success" | "error"
  >("loading");

  useEffect(() => {
    const token = search.token;
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((resp) => resp.json())
      .then((data) => {
        if (
          typeof data.message === "string" &&
          data.message.toLowerCase().includes("valid")
        ) {
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [search.token]);

  async function handleConfirm() {
    const token = search.token;
    if (!token) return;
    setStatus("verifying");

    try {
      const resp = await apiMutate(
        `/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
      );
      const data = await resp.json();
      if (
        typeof data.message === "string" &&
        data.message.toLowerCase().includes("success")
      ) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="text-center space-y-4">
      {status === "loading" && (
        <>
          <Spinner />
          <p>{t("auth.verifying")}</p>
        </>
      )}
      {status === "ready" && (
        <>
          <h2 className="text-lg font-semibold">{t("auth.verified")}</h2>
          <p className="text-text-muted">{t("auth.verifiedMessage")}</p>
          <Button onClick={handleConfirm}>
            {t("auth.confirmVerification")}
          </Button>
        </>
      )}
      {status === "verifying" && (
        <>
          <Spinner />
          <p>{t("auth.verifying")}</p>
        </>
      )}
      {status === "success" && (
        <>
          <h2 className="text-lg font-semibold text-success">
            {t("auth.verified")}
          </h2>
          <p className="text-text-muted">{t("auth.verifiedMessage")}</p>
          <Link to="/login" className="text-primary hover:underline">
            {t("auth.login")}
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h2 className="text-lg font-semibold text-danger">
            {t("auth.error")}
          </h2>
          <p className="text-text-muted">{t("auth.invalidLink")}</p>
        </>
      )}
    </div>
  );
}
