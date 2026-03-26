"use client";

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
      <p className="text-xs text-gray-500">
        {locale === "de"
          ? "Aktive Module für diese Organisation. Deaktivierte Module werden in der Navigation und im Admin-Bereich ausgeblendet."
          : "Active modules for this organisation. Disabled modules are hidden in the navigation and admin area."}
      </p>
      {message && <p className="text-xs text-danger-dark">{message}</p>}
      <ul className="divide-y divide-gray-100">
        {MODULE_KEYS.map(({ key, labelKey }) => (
          <li key={key} className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{t(labelKey, locale)}</div>
                {key === "engagement_tracking" ? (
                  <div className="mt-1 text-xs text-gray-500">{t("settings.engagement_tracking_help", locale)}</div>
                ) : null}
              </div>
              <Switch
                checked={features[key] !== false}
                onToggle={() => handleToggle(String(key), !(features[key] !== false))}
              />
            </div>
            {key === "engagement_tracking" && (
              <div className="sr-only">{t("settings.engagement_tracking_help", locale)}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
