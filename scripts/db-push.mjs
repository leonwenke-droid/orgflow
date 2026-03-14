/**
 * Push Supabase migrations using DATABASE_URL from .env.local (PostgreSQL via pg).
 * No Supabase CLI login required. Run: node scripts/db-push.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
  const content = readFileSync(path, "utf8");
  let databaseUrl = null;
  let poolerUrl = null;
  for (const line of content.split("\n")) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) {
      databaseUrl = m[1].trim().replace(/^["']|["']$/g, "") || null;
    }
    const pm = line.match(/^DATABASE_POOLER_URL=(.+)$/);
    if (pm) {
      poolerUrl = pm[1].trim().replace(/^["']|["']$/g, "") || null;
    }
  }
  if (!databaseUrl) {
    console.error("DATABASE_URL not set in .env.local");
    process.exit(1);
  }
  return { databaseUrl, poolerUrl };
}

const migrations = [
  "supabase/migrations/20260315000000_org_type_and_modules.sql",
  "supabase/migrations/20260315010000_organizations_read_active.sql",
  "supabase/migrations/20260316000000_events_entity.sql",
];

const CONNECT_TIMEOUT_MS = 15000;

async function runMigrations(connectionString) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  await client.connect();
  try {
    for (const rel of migrations) {
      const file = resolve(root, rel);
      if (!existsSync(file)) {
        console.warn("  Skip (not found):", rel);
        continue;
      }
      const sql = readFileSync(file, "utf8");
      console.log("  ", rel);
      await client.query(sql);
    }
  } finally {
    try {
      await client.end();
    } catch (e) {
      console.error("Warning: client.end() failed:", e.message);
    }
  }
}

async function main() {
  const { databaseUrl, poolerUrl } = loadEnv();
  let lastError = null;
  for (const url of [databaseUrl, poolerUrl].filter(Boolean)) {
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
    try {
      console.log("Connecting to database...");
      await client.connect();
      await client.end();
      console.log("Pushing migrations (PostgreSQL)...");
      await runMigrations(url);
      console.log("Done.");
      return;
    } catch (err) {
      lastError = err;
      try {
        await client.end();
      } catch (_) {}
      if (err.code === "ENOTFOUND" && poolerUrl && url === databaseUrl) {
        console.log("Direct host unreachable, trying pooler...");
        continue;
      }
      break;
    }
  }
  console.error("Failed:", lastError.message);
  if (lastError.code === "ENOTFOUND" || lastError.code === "ETIMEDOUT" || lastError.code === "ECONNREFUSED") {
    console.error("Tip: Restore the project in Supabase Dashboard if paused, or set DATABASE_POOLER_URL (Session mode URI from Settings > Database).");
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("Unhandled error:", err.message);
  process.exit(1);
});
