"use client";

import { QRCodeSVG } from "qrcode.react";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

/**
 * Member-facing QR for check-in. Prefers shift `qr_token` URL when available; otherwise falls back to `value` (e.g. assignment URL).
 */
export function MemberQrCode({
  value,
  title,
  memberName
}: {
  value: string;
  title: string;
  memberName: string;
}) {
  const { locale } = useLocale();
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <p className="text-center text-[12px] text-text-secondary">{t("shifts.member_qr_hint", locale)}</p>
      <div className="flex justify-center rounded-lg border border-border-subtle bg-bg-secondary p-4 dark:border-border-default">
        <QRCodeSVG value={value} size={160} level="M" />
      </div>
      <div className="text-center">
        <div className="text-[13px] font-medium text-text-primary">{memberName}</div>
        <div className="text-[11px] text-text-muted">{title}</div>
      </div>
    </div>
  );
}
