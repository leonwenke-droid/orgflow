"use client";

import { useState } from "react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { formatLocaleDateTime } from "../../../../lib/formatDate";
import { approveShiftTransferAction, rejectShiftTransferAction } from "./actions";

export default function ShiftTransferRow({
  request,
  shiftTitle,
  fromName,
  orgSlug
}: {
  request: { id: string; status: string; created_at: string };
  shiftTitle: string;
  fromName: string;
  orgSlug: string;
}) {
  const { locale } = useLocale();
  const [status, setStatus] = useState(request.status);
  const [busy, setBusy] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setBusy(true);
    const fn = action === "approve" ? approveShiftTransferAction : rejectShiftTransferAction;
    const res = await fn(orgSlug, request.id);
    if (!res.error) setStatus(action === "approve" ? "approved" : "rejected");
    setBusy(false);
  }

  const statusTag =
    status === "pending" ? "tag tag-amber" : status === "approved" ? "tag tag-green" : "tag tag-red";
  const statusLabel =
    status === "pending"
      ? t("transfers.status_pending", locale)
      : status === "approved"
        ? t("transfers.status_approved", locale)
        : t("transfers.status_rejected", locale);

  return (
    <tr className="border-b border-border-subtle dark:border-border-default/50 last:border-0">
      <td className="px-4 py-3 font-medium text-text-primary">{shiftTitle}</td>
      <td className="px-4 py-3 text-text-secondary">{fromName}</td>
      <td className="px-4 py-3 text-xs text-text-secondary">{formatLocaleDateTime(request.created_at, locale)}</td>
      <td className="px-4 py-3">
        <span className={statusTag}>{statusLabel}</span>
      </td>
      <td className="px-4 py-3 text-right">
        {status === "pending" ? (
          <div className="flex justify-end gap-2">
            <button onClick={() => handleAction("approve")} disabled={busy} className="btn-primary disabled:opacity-50">
              {t("transfers.approve", locale)}
            </button>
            <button onClick={() => handleAction("reject")} disabled={busy} className="btn-danger disabled:opacity-50">
              {t("transfers.reject", locale)}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

