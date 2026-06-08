/** Session state — TanStack Query hooks for auth. */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWrapper } from "@/shared/api/fetch-wrapper";

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
  const data = await fetchWrapper<AuthStatus>("/api/v1/auth/me");
  return data;
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
    await fetchWrapper("/api/v1/auth/logout", { method: "POST" });
    queryClient.setQueryData(["auth", "me"], {
      authenticated: false,
      user: null,
    });
    queryClient.invalidateQueries({ queryKey: ["auth"] });
  };
}
