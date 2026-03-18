"use client";

import { useEffect } from "react";

const STORAGE_KEY = "orgflow-pending-consent";

export default function ConsentSync() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;

    let payload: any = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    if (!payload || typeof payload !== "object") return;

    (async () => {
      try {
        const res = await fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return null;
}

export function setPendingConsent(payload: { consentType: string; consentValue?: boolean; metadata?: unknown }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

