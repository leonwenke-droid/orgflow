"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground dark:bg-background-dark dark:text-foreground-dark">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12 text-center">
          <h1 className="text-lg font-semibold text-text-primary">Etwas ist schiefgelaufen</h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">
            Bitte erneut versuchen oder die Seite später neu laden.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="btn-primary mt-6 inline-flex justify-center rounded-[var(--radius-input)] px-4 py-2.5 text-sm font-medium"
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
