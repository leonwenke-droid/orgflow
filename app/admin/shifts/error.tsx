"use client";

export default function AdminShiftsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Fehler beim Laden der Schichtplanung
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {error.message || "Ein unerwarteter Fehler ist aufgetreten."}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-gray-400">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:opacity-90 dark:bg-gray-100 dark:text-gray-900"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
