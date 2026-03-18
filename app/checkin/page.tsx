"use client";

import { useEffect, useState } from "react";

export default function CheckinPage({
  searchParams
}: {
  searchParams?: { org?: string; assignmentId?: string };
}) {
  const orgSlug = String(searchParams?.org ?? "").trim();
  const assignmentId = String(searchParams?.assignmentId ?? "").trim();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!orgSlug || !assignmentId) {
        setState("error");
        setMessage("Invalid check-in link.");
        return;
      }
      try {
        const res = await fetch("/api/shifts/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgSlug, assignmentId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState("error");
          setMessage(data.message || "Check-in failed.");
          return;
        }
        setState("ok");
        setMessage("Checked in.");
      } catch {
        setState("error");
        setMessage("Network error.");
      }
    })();
  }, [orgSlug, assignmentId]);

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shift check-in</h1>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        {state === "loading" ? "Checking in…" : message}
      </p>
      {orgSlug && (
        <a className="mt-4 inline-block text-sm text-blue-600 underline dark:text-blue-400" href={`/${encodeURIComponent(orgSlug)}/dashboard`}>
          Back to dashboard
        </a>
      )}
    </div>
  );
}

