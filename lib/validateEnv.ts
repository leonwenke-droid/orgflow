/**
 * Fail fast in production when critical configuration is missing.
 * Called from the root layout during production builds/runtime.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_TEAM",
    "STRIPE_PRICE_TEAM_SCALE",
    "NEXT_PUBLIC_APP_URL",
    "CRON_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN"
  ];

  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nSee .env.example for documentation.`
    );
  }
}
