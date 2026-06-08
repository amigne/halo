import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, Link } from "@tanstack/react-router";
import { Spinner } from "@/shared/ui/Spinner";
import { Button } from "@/shared/ui/Button";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/verify-email" }) as { token?: string };
  const [status, setStatus] = useState<
    "loading" | "ready" | "verifying" | "success" | "error"
  >("loading");

  useEffect(() => {
    const token = search.token;
    if (!token) {
      setStatus("error");
      return;
    }

    // GET checks token validity without consuming it.
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
      const resp = await fetch("/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
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
    <div className="mx-auto max-w-sm space-y-4 p-4 text-center">
      {status === "loading" && (
        <>
          <Spinner />
          <p>{t("auth.verifying")}</p>
        </>
      )}
      {status === "ready" && (
        <>
          <h1 className="text-2xl font-bold">{t("auth.verified")}</h1>
          <p>{t("auth.verifiedMessage")}</p>
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
          <h1 className="text-2xl font-bold text-green-600">
            {t("auth.verified")}
          </h1>
          <p>{t("auth.verifiedMessage")}</p>
          <Link to="/login" className="text-blue-600 hover:underline">
            {t("auth.login")}
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold text-red-600">
            {t("auth.error")}
          </h1>
          <p>{t("auth.invalidLink")}</p>
        </>
      )}
    </div>
  );
}
