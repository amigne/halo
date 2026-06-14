/**
 * Global setup for E2E tests — seeds a verified test user via the backend API.
 *
 * Prerequisites: the full dev stack must be running before Playwright starts.
 *   docker compose -f docker-compose.dev.yml --profile postgres up -d
 *
 * The setup is idempotent and rate-limit friendly: it reuses the previous
 * run's verified user when still connectable, and only creates a fresh user
 * (unique email) when necessary — after a DB reset, an interrupted run, or
 * the very first execution.  A probe login guarantees the user is always
 * connectable before the tests start.
 */

import { request as playwrightRequest } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API = "http://localhost:8000";
const MAILPIT = "http://localhost:8025";
const PASSWORD = "Test1234!";
const CREDENTIALS_DIR = join(__dirname, ".auth");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

/**
 * Clear Redis rate-limit keys so repeated E2E runs never hit the limit.
 *
 * Register is capped at 3/hour, login at 5/minute — both are exhausted
 * quickly when running tests back-to-back.  We target the dev Redis
 * container directly; failures are logged but never block the setup.
 */
function clearRateLimitKeys(): void {
  const prefixes = ["register", "login"];
  for (const prefix of prefixes) {
    try {
      const pattern = `ratelimit:${prefix}:*`;
      const keys = execFileSync(
        "docker",
        ["exec", "halo-redis-dev", "redis-cli", "KEYS", pattern],
        { encoding: "utf-8", timeout: 5_000, stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
      if (keys) {
        for (const key of keys.split("\n")) {
          const trimmed = key.trim();
          if (trimmed) {
            execFileSync(
              "docker",
              ["exec", "halo-redis-dev", "redis-cli", "DEL", trimmed],
              { timeout: 3_000, stdio: ["ignore", "pipe", "pipe"] },
            );
          }
        }
        console.log(`[globalSetup] Cleared rate-limit keys for "${prefix}"`);
      }
    } catch {
      // Redis or Docker not available — rate-limit may apply, setup will
      // fail with a clear error if it can't proceed.
    }
  }
}

async function globalSetup(): Promise<void> {
  // 0. Ensure rate-limit counters are fresh for this run
  clearRateLimitKeys();
  const api = await playwrightRequest.newContext({ baseURL: API });

  // 1. Get CSRF token (required for register + verify-email + login)
  const csrfResp = await api.get("/api/v1/auth/csrf");
  const csrf = (await csrfResp.json()).token as string;

  // 2. Try to reuse the previous run's verified user.
  //    This avoids hitting the register rate limit (3/hour) when running
  //    tests back-to-back — most runs simply probe-login and return.
  let previousEmail: string | undefined;
  try {
    const prev = JSON.parse(
      readFileSync(CREDENTIALS_FILE, "utf-8"),
    ) as { email: string; password: string };
    previousEmail = prev.email;

    const loginResp = await api.post("/api/v1/auth/login", {
      headers: { "X-CSRF-Token": csrf },
      data: { email: prev.email, password: prev.password },
    });
    if (loginResp.ok()) {
      console.log(`[globalSetup] Reusing verified user ${prev.email}`);
      await api.dispose();
      return;
    }
  } catch {
    // No credentials file yet (first run) or unreadable — will create fresh.
  }

  if (previousEmail) {
    console.log(
      `[globalSetup] Previous user ${previousEmail} no longer valid, creating fresh one`,
    );
  }

  // 3. Register a fresh user (only when no reusable user exists).
  //    Unique email → register always sends a verification mail, bypassing
  //    the anti-enumeration silent failure when the email already exists.
  const EMAIL = `e2e-${Date.now()}@halo.local`;

  await api.post("/api/v1/auth/register", {
    headers: { "X-CSRF-Token": csrf },
    data: {
      email: EMAIL,
      password: PASSWORD,
      first_name: "E2E",
      last_name: "User",
    },
  });

  // 4. Poll mailpit for the verification email (tolerates worker latency)
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

  // 5. Verify email
  await api.post(`/api/v1/auth/verify-email?token=${token}`, {
    headers: { "X-CSRF-Token": csrf },
  });
  console.log(`[globalSetup] Verified ${EMAIL}`);

  // 6. Probe login — guarantees the user is connectable (fails loudly if not)
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

  // 7. Persist credentials for the spec
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
