"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { updateOrgFeaturesAction, type FeaturesMap } from "./actions";

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
  initialFeatures
}: {
  orgSlug: string;
  initialFeatures: FeaturesMap;
}) {
  const { locale } = useLocale();
  const [features, setFeatures] = useState<FeaturesMap>(() => ({
    tasks: initialFeatures.tasks !== false,
    shifts: initialFeatures.shifts !== false,
    treasury: initialFeatures.treasury !== false,
    resources: (initialFeatures.resources ?? initialFeatures.materials) !== false,
    engagement_tracking: initialFeatures.engagement_tracking !== false,
    events: initialFeatures.events === true,
  }));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleToggle(key: string, value: boolean) {
    const next = { ...features, [key]: value };
    if (key === "resources") next.materials = value;
    setFeatures(next);
    setLoading(true);
    setMessage(null);
    const payload = key === "resources" ? { [key]: value, materials: value } : { [key]: value };
    const result = await updateOrgFeaturesAction(orgSlug, payload);
    setLoading(false);
    if (result.errorKey) setMessage(t(result.errorKey, locale));
    else if (result.error) setMessage(result.error);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {locale === "de" ? "Aktive Module für diese Organisation. Deaktivierte Module werden in der Navigation und im Admin-Bereich ausgeblendet." : "Active modules for this organisation. Disabled modules are hidden in the navigation and admin area."}
      </p>
      {message && <p className="text-xs text-red-600 dark:text-red-400">{message}</p>}
      <ul className="space-y-2">
        {MODULE_KEYS.map(({ key, labelKey }) => (
          <li key={key} className="space-y-1">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`module-${key}`}
                checked={features[key] !== false}
                disabled={loading}
                onChange={(e) => handleToggle(key, e.target.checked)}
                className="rounded border-gray-400"
              />
              <label htmlFor={`module-${key}`} className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                {t(labelKey, locale)}
              </label>
            </div>
            {key === "engagement_tracking" && (
              <p className="ml-7 text-xs text-gray-500 dark:text-gray-400">{t("settings.engagement_tracking_help", locale)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
