/**
 * Global setup for E2E tests — seeds a verified test user via the backend API.
 *
 * Prerequisites: the full dev stack must be running before Playwright starts.
 *   docker compose -f docker-compose.dev.yml --profile postgres up -d
 *
 * The setup is idempotent: a unique email is generated per run
 * (`e2e-${Date.now()}@halo.local`), so register always sends a fresh
 * verification email.  A probe login at the end guarantees the user is
 * connectable — any failure is surfaced immediately with a clear error
 * message.
 */

import { request as playwrightRequest } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API = "http://localhost:8000";
const MAILPIT = "http://localhost:8025";
const PASSWORD = "Test1234!";
const CREDENTIALS_DIR = join(__dirname, ".auth");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

async function globalSetup(): Promise<void> {
  const EMAIL = `e2e-${Date.now()}@halo.local`;
  const api = await playwrightRequest.newContext({ baseURL: API });

  // 1. Get CSRF token (required for register + verify-email + login)
  const csrfResp = await api.get("/api/v1/auth/csrf");
  const csrf = (await csrfResp.json()).token as string;

  // 2. Register — fresh email → always sends a verification mail
  await api.post("/api/v1/auth/register", {
    headers: { "X-CSRF-Token": csrf },
    data: {
      email: EMAIL,
      password: PASSWORD,
      first_name: "E2E",
      last_name: "User",
    },
  });

  // 3. Poll mailpit for the verification email (tolerates worker latency)
  const mp = await playwrightRequest.newContext({ baseURL: MAILPIT });
  let token: string | undefined;

  const MAX_RETRIES = 20;
  const RETRY_DELAY_MS = 500;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
      const msg = (await msgResp.json()) as {
        HTML?: string;
        Text?: string;
      };
      const body = msg.HTML || msg.Text || "";
      token = body.match(/\/verify-email\?token=([^"&\s<]+)/)?.[1];
      if (token) break;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  if (!token) {
    throw new Error("[globalSetup] no verification email for " + EMAIL);
  }

  // 4. Verify email
  await api.post(`/api/v1/auth/verify-email?token=${token}`, {
    headers: { "X-CSRF-Token": csrf },
  });
  console.log(`[globalSetup] Verified ${EMAIL}`);

  // 5. Probe login — guarantees the user is connectable (fails loudly if not)
  const loginResp = await api.post("/api/v1/auth/login", {
    headers: { "X-CSRF-Token": csrf },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!loginResp.ok()) {
    throw new Error(
      `[globalSetup] probe login failed: ${loginResp.status()} ${await loginResp.text()}`,
    );
  }
  console.log(`[globalSetup] Probe login OK for ${EMAIL}`);

  // 6. Persist credentials for the spec
  mkdirSync(CREDENTIALS_DIR, { recursive: true });
  writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
  );
  console.log(`[globalSetup] Credentials written to ${CREDENTIALS_FILE}`);

  await mp.dispose();
  await api.dispose();
}

export default globalSetup;
