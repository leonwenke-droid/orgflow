"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { updateOrgFeaturesAction, type FeaturesMap } from "./actions";
import { Switch } from "../../../components/ui/Switch";

const MODULE_KEYS: { key: keyof FeaturesMap; labelKey: string }[] = [
  { key: "tasks", labelKey: "dashboard.tasks" },
  { key: "shifts", labelKey: "dashboard.shifts" },
  { key: "treasury", labelKey: "dashboard.finance" },
  { key: "resources", labelKey: "dashboard.resources" },
  { key: "engagement_tracking", labelKey: "dashboard.engagement" },
  { key: "events", labelKey: "events.title" },
];

export default function ModuleToggles({
  orgSlug,
  initialFeatures,
  currentPlan = "free"
}: {
  orgSlug: string;
  initialFeatures: FeaturesMap;
  /** organisations.plan — Engagement only on paid tiers */
  currentPlan?: string;
}) {
  const { locale } = useLocale();
  const isFreePlan = String(currentPlan ?? "free").trim() === "free";
  const [savedFeatures, setSavedFeatures] = useState<FeaturesMap>(() => ({
    tasks: initialFeatures.tasks !== false,
    shifts: initialFeatures.shifts !== false,
    treasury: initialFeatures.treasury !== false,
    resources: (initialFeatures.resources ?? initialFeatures.materials) !== false,
    engagement_tracking: isFreePlan ? false : initialFeatures.engagement_tracking !== false,
    events: initialFeatures.events === true,
  }));
  const [features, setFeatures] = useState<FeaturesMap>(() => ({ ...savedFeatures }));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmEngagementOff, setConfirmEngagementOff] = useState(false);
  const [confirmEngagementUpgrade, setConfirmEngagementUpgrade] = useState(false);

  const isDirty =
    Object.keys(features).some((k) => (features as any)[k] !== (savedFeatures as any)[k]);

  function stageToggle(key: string, value: boolean) {
    const next = { ...features, [key]: value };
    if (key === "resources") next.materials = value;
    setFeatures(next);
    setMessage(null);
  }

  function requestToggle(key: string) {
    const current = features[key] !== false;
    const nextValue = !current;
    if (key === "engagement_tracking" && isFreePlan && nextValue === true) {
      setConfirmEngagementUpgrade(true);
      return;
    }
    if (key === "engagement_tracking" && current === true && nextValue === false) {
      setConfirmEngagementOff(true);
      return;
    }
    stageToggle(String(key), nextValue);
  }

  async function applyChanges() {
    if (!isDirty) return;
    setLoading(true);
    setMessage(null);
    const diff: Partial<FeaturesMap> = {};
    for (const [k, v] of Object.entries(features)) {
      if ((savedFeatures as any)[k] !== v) (diff as any)[k] = v;
    }
    const result = await updateOrgFeaturesAction(orgSlug, diff);
    setLoading(false);
    if (result.errorKey) setMessage(t(result.errorKey, locale));
    else if (result.error) setMessage(result.error);
    else setSavedFeatures({ ...features });
  }

  function discardChanges() {
    setFeatures({ ...savedFeatures });
    setMessage(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">
        {locale === "de"
          ? "Aktive Module für diese Organisation. Deaktivierte Module werden in der Navigation und im Admin-Bereich ausgeblendet."
          : "Active modules for this organisation. Disabled modules are hidden in the navigation and admin area."}
      </p>
      {message && <p className="text-xs text-danger-dark">{message}</p>}
      {isDirty ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-xs dark:border-border-default dark:bg-bg-primary/60">
          <span className="text-text-secondary dark:text-text-muted">
            {locale === "de" ? "Änderungen ausstehend" : "Changes pending"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => discardChanges()}
              disabled={loading}
              className="rounded-lg border border-border-default px-3 py-1.5 font-semibold text-text-primary hover:bg-bg-primary disabled:opacity-50 dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
            >
              {locale === "de" ? "Verwerfen" : "Discard"}
            </button>
            <button
              type="button"
              onClick={() => applyChanges()}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (locale === "de" ? "Speichern…" : "Saving…") : (locale === "de" ? "Änderungen anwenden" : "Apply changes")}
            </button>
          </div>
        </div>
      ) : null}
      <ul className="divide-y divide-gray-100">
        {MODULE_KEYS.map(({ key, labelKey }) => (
          <li key={key} className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">{t(labelKey, locale)}</div>
                {key === "engagement_tracking" ? (
                  <>
                    <div className="mt-1 text-xs text-text-secondary">{t("settings.engagement_tracking_help", locale)}</div>
                    {isFreePlan ? (
                      <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200/90">
                        {t("settings.engagement_free_hint", locale)}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Switch
                checked={
                  key === "engagement_tracking" && isFreePlan ? false : features[key] !== false
                }
                onToggle={() => requestToggle(String(key))}
              />
            </div>
            {key === "engagement_tracking" && (
              <div className="sr-only">{t("settings.engagement_tracking_help", locale)}</div>
            )}
          </li>
        ))}
      </ul>

      {confirmEngagementUpgrade ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmEngagementUpgrade(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-xl dark:border-border-default dark:bg-bg-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-primary dark:text-text-primary">
              {t("settings.engagement_upgrade_modal_title", locale)}
            </h3>
            <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">
              {t("settings.engagement_upgrade_modal_body", locale)}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEngagementUpgrade(false)}
                className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary dark:border-border-default dark:hover:bg-bg-primary"
              >
                {locale === "de" ? "Schließen" : "Close"}
              </button>
              <Link
                href={`/${orgSlug}/settings#settings-plan`}
                onClick={() => setConfirmEngagementUpgrade(false)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {t("settings.engagement_upgrade_cta", locale)}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {confirmEngagementOff ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmEngagementOff(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-xl dark:border-border-default dark:bg-bg-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-primary dark:text-text-primary">
              {locale === "de" ? "Engagement deaktivieren?" : "Disable engagement?"}
            </h3>
            <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">
              {locale === "de"
                ? "Wenn du Engagement deaktivierst, werden Score/Ranglisten ausgeblendet und es werden keine neuen Engagement-Punkte mehr gesammelt."
                : "When engagement is disabled, score/rankings are hidden and no new engagement points are collected."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEngagementOff(false)}
                className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary dark:border-border-default dark:hover:bg-bg-primary"
              >
                {locale === "de" ? "Abbrechen" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmEngagementOff(false);
                  stageToggle("engagement_tracking", false);
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                {locale === "de" ? "Deaktivieren" : "Disable"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
