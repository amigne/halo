/**
 * Generate typed API client from the backend's OpenAPI spec (T-061, T-136).
 *
 * Usage:
 *   npx tsx scripts/generate-api.ts [backend-url]
 *
 * Default backend URL: http://localhost:8000
 *
 * The script fetches the OpenAPI JSON from the running backend and pipes it
 * through openapi-typescript to produce `src/shared/api/client.ts`.
 * The generated file is committed so the frontend can type-check without
 * a running backend.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const backendUrl = process.argv[2] || "http://localhost:8000";
const openapiUrl = `${backendUrl}/openapi.json`;

console.log(`Fetching OpenAPI spec from ${openapiUrl}…`);

const response = await fetch(openapiUrl);
if (!response.ok) {
  console.error(
    `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
  );
  console.error("Make sure the backend is running and accessible.");
  process.exit(1);
}

const spec = JSON.stringify(await response.json());

// Write temporary spec file for openapi-typescript
const tmpSpecPath = resolve(import.meta.dirname!, "..", ".openapi-tmp.json");
writeFileSync(tmpSpecPath, spec, "utf-8");

const outPath = resolve(import.meta.dirname!, "..", "src", "shared", "api", "client.ts");

console.log("Generating TypeScript types…");
execSync(`npx openapi-typescript ${tmpSpecPath} -o ${outPath}`, {
  stdio: "inherit",
});

// Clean up
const { unlinkSync } = await import("node:fs");
unlinkSync(tmpSpecPath);

console.log(`✓ API client generated at ${outPath}`);
