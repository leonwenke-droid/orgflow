"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-background-dark text-foreground-dark">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-dark">
            Please try again. If the problem persists, contact support.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => reset()}
              className="rounded-md bg-bg-primary/10 px-4 py-2 text-sm font-medium hover:bg-bg-primary/15"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium hover:bg-bg-primary/5"
            >
              Go home
            </a>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-4 text-xs text-foreground-dark/90">
              {String(error?.message || error)}
              {"\n"}
              {error?.stack ? String(error.stack) : ""}
            </pre>
          ) : null}
        </div>
      </body>
    </html>
  );
}

