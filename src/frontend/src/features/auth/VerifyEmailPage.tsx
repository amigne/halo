import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, Link } from "@tanstack/react-router";
import { Spinner } from "@/shared/ui/Spinner";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/verify-email" }) as { token?: string };
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

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
          data.message.toLowerCase().includes("success")
        ) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [search.token]);

  return (
    <div className="mx-auto max-w-sm space-y-4 p-4 text-center">
      {status === "loading" && (
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
