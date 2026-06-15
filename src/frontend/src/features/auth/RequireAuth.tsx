import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/auth-store";
import { Spinner } from "@/shared/ui/Spinner";

/** Gate applicatif : exige une session, sinon redirige vers /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: auth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!auth?.authenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
