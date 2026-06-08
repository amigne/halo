/** Session state — TanStack Query hooks for auth. */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiMutate } from "@/shared/api/fetch-wrapper";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_verified: boolean;
  locale: string;
  theme: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

interface AuthStatus {
  authenticated: boolean;
  user: User | null;
}

async function fetchAuthStatus(): Promise<AuthStatus> {
  const resp = await fetch("/api/v1/auth/me", {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    return { authenticated: false, user: null };
  }
  return resp.json();
}

export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchAuthStatus,
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return async () => {
    await apiMutate("/api/v1/auth/logout");
    queryClient.setQueryData(["auth", "me"], {
      authenticated: false,
      user: null,
    });
    queryClient.invalidateQueries({ queryKey: ["auth"] });
  };
}
