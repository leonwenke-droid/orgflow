/**
 * Production startup checks: fail only on core app config.
 * Billing, crons, and Upstash are warned or validated when Stripe is enabled.
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const core = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL"
  ];

  const missingCore = core.filter((k) => !process.env[k]?.trim());
  if (missingCore.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missingCore.map((k) => `  - ${k}`).join("\n")}\n\nSee .env.example for documentation.`
    );
  }

  const warnMissing = (keys: string[], hint: string) => {
    const missing = keys.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
      console.warn(
        `[validateProductionEnv] Not set in production: ${missing.join(", ")}. ${hint}`
      );
    }
  };

  warnMissing(
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    "Rate limiting is ineffective across serverless instances until Upstash is configured."
  );
  warnMissing(
    ["CRON_SECRET"],
    "/api/cron/* will respond with 500 until CRON_SECRET is set."
  );

  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  if (hasStripe) {
    const stripeRequired = [
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_TEAM",
      "STRIPE_PRICE_TEAM_SCALE"
    ];
    const missingStripe = stripeRequired.filter((k) => !process.env[k]?.trim());
    if (missingStripe.length > 0) {
      throw new Error(
        `STRIPE_SECRET_KEY is set but billing configuration is incomplete:\n${missingStripe.map((k) => `  - ${k}`).join("\n")}\n\nSee .env.example for documentation.`
      );
    }
  } else {
    console.warn(
      "[validateProductionEnv] STRIPE_SECRET_KEY not set — Stripe checkout and webhooks will not work until configured."
    );
  }
}
