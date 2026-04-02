"use client";

import { useEffect } from "react";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OrgError]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg p-10 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h2 className="text-lg font-semibold text-text-primary dark:text-text-primary">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <button onClick={reset} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
