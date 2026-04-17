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

/** Tasks/shifts stay available on Free; these need a paid plan to turn on. */
const PAID_MODULE_KEYS = new Set<string>([
  "treasury",
  "resources",
  "engagement_tracking",
  "events",
]);

function isModuleEnabled(key: string, f: FeaturesMap): boolean {
  if (key === "events") return f.events === true;
  if (key === "resources") return (f.resources ?? f.materials) !== false;
  return f[key] !== false;
}

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
    treasury: isFreePlan ? false : initialFeatures.treasury !== false,
    resources: isFreePlan ? false : (initialFeatures.resources ?? initialFeatures.materials) !== false,
    engagement_tracking: isFreePlan ? false : initialFeatures.engagement_tracking !== false,
    events: isFreePlan ? false : initialFeatures.events === true,
  }));
  const [features, setFeatures] = useState<FeaturesMap>(() => ({ ...savedFeatures }));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmEngagementOff, setConfirmEngagementOff] = useState(false);
  const [confirmPaidUpgradeFor, setConfirmPaidUpgradeFor] = useState<string | null>(null);

  function paidUpgradeModalKeys(modKey: string): { title: string; body: string } {
    if (modKey === "engagement_tracking") {
      return { title: "settings.engagement_upgrade_modal_title", body: "settings.engagement_upgrade_modal_body" };
    }
    if (modKey === "treasury") {
      return { title: "settings.treasury_upgrade_modal_title", body: "settings.treasury_upgrade_modal_body" };
    }
    if (modKey === "resources") {
      return { title: "settings.resources_upgrade_modal_title", body: "settings.resources_upgrade_modal_body" };
    }
    if (modKey === "events") {
      return { title: "settings.events_upgrade_modal_title", body: "settings.events_upgrade_modal_body" };
    }
    return { title: "settings.engagement_upgrade_modal_title", body: "settings.engagement_upgrade_modal_body" };
  }

  const isDirty =
    Object.keys(features).some((k) => (features as any)[k] !== (savedFeatures as any)[k]);

  const paidUpgradeCopy =
    confirmPaidUpgradeFor != null ? paidUpgradeModalKeys(confirmPaidUpgradeFor) : null;

  function stageToggle(key: string, value: boolean) {
    const next = { ...features, [key]: value };
    if (key === "resources") next.materials = value;
    setFeatures(next);
    setMessage(null);
  }

  function requestToggle(key: string) {
    const current = isModuleEnabled(key, features);
    const nextValue = !current;
    if (isFreePlan && PAID_MODULE_KEYS.has(key) && nextValue === true) {
      setConfirmPaidUpgradeFor(key);
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
                {key === "treasury" ? (
                  <>
                    <div className="mt-1 text-xs text-text-secondary">{t("settings.treasury_module_help", locale)}</div>
                    {isFreePlan ? (
                      <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200/90">
                        {t("settings.engagement_free_hint", locale)}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {key === "resources" ? (
                  <>
                    <div className="mt-1 text-xs text-text-secondary">{t("settings.resources_module_help", locale)}</div>
                    {isFreePlan ? (
                      <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200/90">
                        {t("settings.engagement_free_hint", locale)}
                      </p>
                    ) : null}
                  </>
                ) : null}
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
                {key === "events" ? (
                  <>
                    <div className="mt-1 text-xs text-text-secondary">{t("settings.events_module_help", locale)}</div>
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
                  isFreePlan && PAID_MODULE_KEYS.has(String(key)) ? false : isModuleEnabled(String(key), features)
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

      {confirmPaidUpgradeFor ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmPaidUpgradeFor(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-xl dark:border-border-default dark:bg-bg-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-primary dark:text-text-primary">
              {paidUpgradeCopy ? t(paidUpgradeCopy.title, locale) : null}
            </h3>
            <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">
              {paidUpgradeCopy ? t(paidUpgradeCopy.body, locale) : null}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPaidUpgradeFor(null)}
                className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary dark:border-border-default dark:hover:bg-bg-primary"
              >
                {locale === "de" ? "Schließen" : "Close"}
              </button>
              <Link
                href={`/${orgSlug}/settings#settings-plan`}
                onClick={() => setConfirmPaidUpgradeFor(null)}
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
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
