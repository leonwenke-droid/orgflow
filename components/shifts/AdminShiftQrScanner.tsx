"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (image: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
};

function parseCheckinPayload(text: string): { orgSlug: string; assignmentId?: string; shiftId?: string } | null {
  try {
    const u = new URL(text.trim(), typeof window !== "undefined" ? window.location.origin : "https://example.com");
    const org = u.searchParams.get("org");
    if (!org) return null;
    /** Shift `qr_token` check-in is for the member’s own session at /checkin, not for admin scanner (RPC binds logged-in profile). */
    if (u.searchParams.get("qr_token")) return null;
    const assignmentId = u.searchParams.get("assignmentId") ?? undefined;
    const shiftId = u.searchParams.get("shiftId") ?? undefined;
    if (!assignmentId && !shiftId) return null;
    return { orgSlug: org, assignmentId, shiftId };
  } catch {
    return null;
  }
}

export default function AdminShiftQrScanner({
  defaultOrgSlug,
  onCheckInSuccess
}: {
  defaultOrgSlug: string | null;
  onCheckInSuccess?: (payload: { assignmentId?: string; shiftId?: string }) => void;
}) {
  const { locale } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const postCheckin = useCallback(
    async (parsed: { orgSlug: string; assignmentId?: string; shiftId?: string }) => {
      setStatus(null);
      const body: Record<string, string> = { orgSlug: parsed.orgSlug };
      if (parsed.assignmentId) body.assignmentId = parsed.assignmentId;
      if (parsed.shiftId) body.shiftId = parsed.shiftId;
      const res = await fetch("/api/shifts/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; ok?: boolean };
      if (!res.ok) {
        setStatus(data.message || t("shifts.scanner_checkin_failed", locale));
        return;
      }
      setStatus(t("shifts.scanner_checkin_ok", locale));
      onCheckInSuccess?.({ assignmentId: parsed.assignmentId, shiftId: parsed.shiftId });
    },
    [locale, onCheckInSuccess]
  );

  const onDecoded = useCallback(
    (text: string) => {
      const parsed = parseCheckinPayload(text);
      if (!parsed) {
        setStatus(t("shifts.scanner_invalid_qr", locale));
        return;
      }
      void postCheckin(parsed);
    },
    [postCheckin, locale]
  );

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startScan = async () => {
    setStatus(null);
    const BD = (typeof window !== "undefined" && (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector) || null;
    if (!BD || !navigator.mediaDevices?.getUserMedia) {
      setStatus(t("shifts.scanner_no_camera_api", locale));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      scanningRef.current = true;
      setScanning(true);
      const detector = new BD({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || !scanningRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (raw) {
            onDecoded(raw);
            stopCamera();
            return;
          }
        } catch {
          /* ignore frame errors */
        }
        if (scanningRef.current) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setStatus(t("shifts.scanner_camera_denied", locale));
    }
  };

  const submitPaste = () => {
    const parsed = parseCheckinPayload(pasteUrl);
    if (!parsed) {
      setStatus(t("shifts.scanner_invalid_qr", locale));
      return;
    }
    void postCheckin(parsed);
  };

  return (
    <div className="rounded-[var(--radius-modal)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 dark:border-white/10">
      <h4 className="text-xs font-semibold text-text-primary">{t("shifts.scanner_title", locale)}</h4>
      <p className="mt-1 text-[10px] text-text-muted">{t("shifts.scanner_hint", locale)}</p>
      <div className="relative mt-2 flex max-h-[200px] aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black/80">
        <video ref={videoRef} className="max-h-full w-full object-cover" playsInline muted />
        {!scanning && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-[11px] text-white/70">
            {t("shifts.scanner_placeholder", locale)}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {!scanning ? (
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => void startScan()}>
            {t("shifts.scanner_start", locale)}
          </button>
        ) : (
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={stopCamera}>
            {t("shifts.scanner_stop", locale)}
          </button>
        )}
      </div>
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        <label className="text-[10px] font-semibold text-text-secondary">{t("shifts.scanner_paste_label", locale)}</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder={
              defaultOrgSlug
                ? `https://…/checkin?org=${defaultOrgSlug}&assignmentId=…`
                : "https://…/checkin?org=…&assignmentId=…"
            }
            className="ui-input min-h-[40px] flex-1 p-2 text-xs"
          />
          <button type="button" className="btn-secondary px-3 py-2 text-xs shrink-0" onClick={submitPaste}>
            {t("shifts.scanner_paste_submit", locale)}
          </button>
        </div>
      </div>
      {status && <p className="mt-2 text-[11px] text-text-primary">{status}</p>}
    </div>
  );
}
