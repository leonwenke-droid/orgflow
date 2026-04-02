"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function EmailVerificationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data && data.emailConfirmed === false) setShow(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-[var(--color-warning)]/30 bg-[var(--bg-warning-subtle)] px-4 py-2 text-center text-sm text-[var(--color-warning-text)]">
      Please verify your email to get the full experience.{" "}
      <Link href="/auth/callback" className="font-medium underline">Check your inbox</Link> or request a new link from your admin.
    </div>
  );
}
