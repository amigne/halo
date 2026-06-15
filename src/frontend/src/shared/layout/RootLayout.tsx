import { Outlet } from "@tanstack/react-router";

/** Racine neutre : aucun chrome, délègue au layout enfant (auth ou app). */
export function RootLayout() {
  return <Outlet />;
}
