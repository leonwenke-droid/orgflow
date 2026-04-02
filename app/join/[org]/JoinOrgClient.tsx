"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthForm from "../../../components/AuthForm";

export default function JoinOrgClient({
  orgSlug,
  orgName,
  token,
  user,
}: {
  orgSlug: string;
  orgName: string;
  token: string;
  user: { id: string; email?: string } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = `/join/${orgSlug}?token=${encodeURIComponent(token)}`;

  if (user) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-text-secondary">
          You&apos;re signed in. Click below to join the organisation.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              const res = await fetch("/api/join-org", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgSlug, token }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data.message || "Failed to join.");
                setLoading(false);
                return;
              }
              router.push(`/${orgSlug}/dashboard`);
            } catch {
              setError("Network error.");
              setLoading(false);
            }
          }}
        >
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join organisation"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-border-subtle bg-bg-secondary p-4">
        <h2 className="text-sm font-semibold text-text-primary">Anmelden, um beizutreten</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Melde dich mit deinem Account an (oder erstelle einen), um {orgName} beizutreten.
        </p>
        <div className="mt-3">
          <AuthForm redirectTo={redirectTo} />
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Noch kein Account?{" "}
        <Link href={`/auth/lead-setup?next=${encodeURIComponent(redirectTo)}`} className="text-blue-600 hover:underline">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
