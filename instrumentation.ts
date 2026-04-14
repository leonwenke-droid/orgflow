import { validateProductionEnv } from "./lib/validateEnv";

export async function register() {
  validateProductionEnv();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
