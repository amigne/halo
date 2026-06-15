import { AppLayout } from "./App";
import { RequireAuth } from "@/features/auth/RequireAuth";

/** Wraps the app shell with the auth gate. */
export function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppLayout />
    </RequireAuth>
  );
}
