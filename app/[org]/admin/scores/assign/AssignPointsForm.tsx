"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignPoints, getAssignPointsPreview } from "./actions";
import { useLocale } from "../../../../../components/LocaleProvider";
import { t } from "../../../../../lib/i18n";

type Member = { id: string; full_name: string };

const MIN_REASON_NEGATIVE = 20;
const MIN_REASON_POSITIVE = 5;

export default function AssignPointsForm({
  orgSlug,
  members
}: {
  orgSlug: string;
  members: Member[];
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [profileId, setProfileId] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [pendingPoints, setPendingPoints] = useState<number | null>(null);
  const [pendingReason, setPendingReason] = useState("");

  function memberName(id: string) {
    return members.find((m) => m.id === id)?.full_name ?? "–";
  }

  async function handleRequestConfirm(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(points, 10);
    const trimmedReason = reason.trim();
    if (!profileId || isNaN(num)) {
      setMessage({ type: "error", text: t("engagement.assign_validation", locale) });
      return;
    }
    if (!trimmedReason) {
      setMessage({ type: "error", text: t("engagement.reason_required", locale) });
      return;
    }
    if (num < 0 && trimmedReason.length < MIN_REASON_NEGATIVE) {
      setMessage({
        type: "error",
        text: t("engagement.reason_negative_min", locale).replace(
          "{min}",
          String(MIN_REASON_NEGATIVE)
        )
      });
      return;
    }
    if (num >= 0 && trimmedReason.length < MIN_REASON_POSITIVE) {
      setMessage({
        type: "error",
        text: t("engagement.reason_positive_min", locale).replace(
          "{min}",
          String(MIN_REASON_POSITIVE)
        )
      });
      return;
    }

    setMessage(null);
    setPendingPoints(num);
    setPendingReason(trimmedReason);
    setModalOpen(true);
    setPreviewLoading(true);
    setPreviewScore(null);

    const res = await getAssignPointsPreview(orgSlug, profileId);
    setPreviewLoading(false);
    if ("errorKey" in res && res.errorKey) {
      setMessage({ type: "error", text: t(res.errorKey, locale) });
      setModalOpen(false);
      return;
    }
    if ("currentScore" in res) {
      setPreviewScore(res.currentScore);
    }
  }

  async function handleConfirmAssign() {
    if (pendingPoints == null || !profileId) return;
    setLoading(true);
    setMessage(null);
    const result = await assignPoints(orgSlug, profileId, pendingPoints, pendingReason);
    setLoading(false);
    if ("errorKey" in result && result.errorKey) {
      setMessage({ type: "error", text: t(result.errorKey, locale) });
      return;
    }
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setModalOpen(false);
    setMessage({ type: "ok", text: t("engagement.assign_success", locale) });
    setPoints("");
    setReason("");
    setPendingPoints(null);
    setPendingReason("");
    setPreviewScore(null);
    router.refresh();
  }

  const delta = pendingPoints ?? 0;
  const afterScore =
    previewScore !== null && pendingPoints !== null ? previewScore + pendingPoints : null;

  return (
    <>
      <form onSubmit={handleRequestConfirm} className="mt-6 space-y-4 rounded-lg border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default bg-card">
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary dark:text-text-primary">
            {t("engagement.assign_member", locale)}
          </label>
          <select
            required
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full rounded border border-border-default bg-bg-primary p-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
          >
            <option value="">{t("engagement.assign_select", locale)}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary dark:text-text-primary">
            {t("engagement.assign_points_label", locale)}
          </label>
          <input
            type="number"
            required
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder={t("engagement.assign_points_placeholder", locale)}
            className="w-full rounded border border-border-default bg-bg-primary p-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-secondary dark:text-text-primary">
            {t("engagement.assign_reason_label", locale)}{" "}
            <span className="font-normal text-text-secondary dark:text-text-muted">
              {t("engagement.assign_reason_hint_required", locale)}
            </span>
          </label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("engagement.assign_reason_placeholder", locale)}
            rows={3}
            className="w-full resize-y rounded border border-border-default bg-bg-primary p-2 text-sm dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
          />
          <p className="mt-1 text-[11px] text-text-secondary dark:text-text-muted">
            {t("engagement.reason_negative_min", locale).replace("{min}", String(MIN_REASON_NEGATIVE))}{" "}
            · {t("engagement.reason_positive_min", locale).replace("{min}", String(MIN_REASON_POSITIVE))}
          </p>
        </div>
        {message && (
          <p
            className={
              message.type === "error"
                ? "text-sm text-red-600 dark:text-red-400"
                : "text-sm text-green-600 dark:text-green-400"
            }
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || previewLoading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {previewLoading ? "…" : t("engagement.assign_submit", locale)}
        </button>
      </form>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-confirm-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border-subtle bg-bg-primary p-5 shadow-xl dark:border-border-default dark:bg-bg-primary">
            <h2 id="assign-confirm-title" className="text-lg font-semibold text-text-primary dark:text-text-primary">
              {t("engagement.assign_confirm_title", locale)}
            </h2>
            <dl className="mt-4 space-y-2 text-sm text-text-secondary dark:text-text-secondary">
              <div>
                <dt className="text-xs font-medium text-text-secondary dark:text-text-muted">
                  {t("engagement.assign_confirm_member", locale)}
                </dt>
                <dd>{memberName(profileId)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-text-secondary dark:text-text-muted">
                  {t("engagement.assign_confirm_points", locale)}
                </dt>
                <dd className="font-mono">
                  {delta > 0 ? `+${delta}` : String(delta)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-text-secondary dark:text-text-muted">
                  {t("engagement.assign_confirm_current", locale)}
                </dt>
                <dd>
                  {previewLoading ? "…" : previewScore === null ? "—" : String(previewScore)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-text-secondary dark:text-text-muted">
                  {t("engagement.assign_confirm_after", locale)}
                </dt>
                <dd className="font-semibold">
                  {previewLoading ? "…" : afterScore === null ? "—" : String(afterScore)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-text-secondary dark:text-text-muted">
                  {t("engagement.assign_confirm_reason", locale)}
                </dt>
                <dd className="whitespace-pre-wrap text-text-secondary dark:text-text-muted">{pendingReason}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                className="rounded border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary disabled:opacity-50 dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
                onClick={() => {
                  setModalOpen(false);
                  setPreviewScore(null);
                  setPendingPoints(null);
                  setPendingReason("");
                }}
              >
                {t("engagement.assign_confirm_cancel", locale)}
              </button>
              <button
                type="button"
                disabled={loading || previewLoading || previewScore === null}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                onClick={() => void handleConfirmAssign()}
              >
                {loading ? t("engagement.assign_saving", locale) : t("engagement.assign_confirm_submit", locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
