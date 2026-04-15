"use client";

import { useState } from "react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { formatLocaleDateTime } from "../../../../lib/formatDate";
import { approveUnavailabilityAction, rejectUnavailabilityAction } from "../unavailability-review-actions";

type Props = {
  row: {
    id: string;
    status: string;
    unavailable_from: string;
    unavailable_until: string;
    reason: string | null;
    created_at: string;
    reviewed_at: string | null;
  };
  memberName: string;
  orgSlug: string;
};

export default function UnavailabilityReviewRow({ row, memberName, orgSlug }: Props) {
  const { locale } = useLocale();
  const [status, setStatus] = useState(row.status);
  const [busy, setBusy] = useState(false);

  async function handle(action: "approve" | "reject") {
    setBusy(true);
    const fn = action === "approve" ? approveUnavailabilityAction : rejectUnavailabilityAction;
    const result = await fn(orgSlug, row.id);
    if (!result.error) {
      setStatus(action === "approve" ? "approved" : "rejected");
    }
    setBusy(false);
  }

  const statusTag =
    status === "pending" ? "tag tag-amber" : status === "approved" ? "tag tag-green" : "tag tag-red";

  const statusLabel =
    status === "pending"
      ? t("unavailability.status_pending", locale)
      : status === "approved"
        ? t("unavailability.status_approved", locale)
        : t("unavailability.status_rejected", locale);

  const from = new Date(row.unavailable_from);
  const until = new Date(row.unavailable_until);
  const period = `${from.toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium" })} – ${until.toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium" })}`;

  return (
    <tr className="border-b border-border-subtle dark:border-border-default/50 last:border-0">
      <td className="px-4 py-3 font-medium text-text-primary dark:text-text-primary">{memberName}</td>
      <td className="px-4 py-3 text-sm text-text-secondary dark:text-text-muted">{period}</td>
      <td className="max-w-[200px] px-4 py-3 text-xs text-text-secondary">{row.reason ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-text-secondary">{formatLocaleDateTime(row.created_at, locale)}</td>
      <td className="px-4 py-3">
        <span className={statusTag}>{statusLabel}</span>
      </td>
      <td className="px-4 py-3 text-right">
        {status === "pending" ? (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => void handle("approve")} disabled={busy} className="btn-primary disabled:opacity-50">
              {t("transfers.approve", locale)}
            </button>
            <button type="button" onClick={() => void handle("reject")} disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {t("transfers.reject", locale)}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
