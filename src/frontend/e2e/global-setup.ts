/**
 * Global setup for E2E tests — seeds a verified test user via the backend API.
 *
 * Prerequisites: the full dev stack must be running before Playwright starts.
 *   docker compose -f docker-compose.dev.yml --profile postgres up -d
 *
 * The setup is idempotent: if the user already exists and is verified,
 * the missing verification email is not an error.
 */

import { request as playwrightRequest } from "@playwright/test";

const API = "http://localhost:8000";
const MAILPIT = "http://localhost:8025";
const EMAIL = "e2e-real@halo.local";
const PASSWORD = "Test1234!";

async function globalSetup(): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: API });

  // 1. Get CSRF token (required for register + verify-email)
  const csrfResp = await api.get("/api/v1/auth/csrf");
  const csrf = (await csrfResp.json()).token as string;

  // 2. Register (idempotent — same response if account already exists)
  await api.post("/api/v1/auth/register", {
    headers: { "X-CSRF-Token": csrf },
    data: {
      email: EMAIL,
      password: PASSWORD,
      first_name: "E2E",
      last_name: "User",
    },
  });

  // 3. Verify email via mailpit (tolerant — if already verified, skip)
  try {
    const mp = await playwrightRequest.newContext({ baseURL: MAILPIT });
    const msgsResp = await mp.get("/api/v1/messages?limit=50");
    const msgs = (await msgsResp.json()) as {
      messages?: Array<{
        ID: string;
        To?: Array<{ Address: string }>;
      }>;
    };

    const mine = msgs.messages?.find((m) =>
      m.To?.some((t) => t.Address === EMAIL),
    );
    if (mine) {
      const msgResp = await mp.get(`/api/v1/message/${mine.ID}`);
      const html = (await msgResp.json()) as {
        HTML?: string;
        Text?: string;
      };
      const body = html.HTML ?? html.Text ?? "";
      const token = body.match(
        /verify-email\?token=([^"&\s<]+)/,
      )?.[1];
      if (token) {
        await api.post(`/api/v1/auth/verify-email?token=${token}`, {
          headers: { "X-CSRF-Token": csrf },
        });
        console.log(`[globalSetup] Verified ${EMAIL}`);
      }
    }
    await mp.dispose();
  } catch {
    // Mailpit or verification not available — login may still work
    // if the user was verified in a previous run
    console.log(
      "[globalSetup] Could not verify email via mailpit — user may already be verified",
    );
  }

  await api.dispose();
}

export default globalSetup;
