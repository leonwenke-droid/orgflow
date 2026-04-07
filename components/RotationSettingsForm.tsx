"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { updateRotationConfigAction } from "../app/[org]/settings/rotation-actions";
import { mergeRotationConfig, type RotationConfig } from "../lib/rotationConfig";

export default function RotationSettingsForm({
  orgSlug,
  initial
}: {
  orgSlug: string;
  initial: unknown;
}) {
  const { locale } = useLocale();
  const base = mergeRotationConfig(initial);
  const [cfg, setCfg] = useState(base);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(partial: Partial<RotationConfig>) {
    setLoading(true);
    setMsg(null);
    const res = await updateRotationConfigAction(orgSlug, partial);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else {
      setCfg((c) => ({ ...c, ...partial }));
      setMsg(locale === "de" ? "Gespeichert." : "Saved.");
    }
  }

  const de = locale === "de";

  return (
    <div className="space-y-4 text-sm">
      <p className="text-text-secondary dark:text-text-muted">
        {de
          ? "Gewichtung für faire Rotation (niedrigster Score wird zuerst zugeteilt). Auto-Zuteilung (Zufall) bleibt unverändert."
          : "Weights for fair rotation (lowest score is assigned first). Random auto-assign is unchanged."}
      </p>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={cfg.enabled}
          disabled={loading}
          onChange={(e) => {
            const enabled = e.target.checked;
            setCfg((c) => ({ ...c, enabled }));
            void save({ enabled });
          }}
        />
        <span>{de ? "Rotation aktiv" : "Rotation enabled"}</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <div className="mb-1 text-xs text-text-secondary">{de ? "Punkte bei Zuteilung" : "Points on assignment"}</div>
          <input
            type="number"
            min={1}
            max={50}
            step={1}
            className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5"
            value={cfg.pts_on_assignment}
            disabled={loading}
            onChange={(e) => setCfg((c) => ({ ...c, pts_on_assignment: Number(e.target.value) }))}
            onBlur={() => save({ pts_on_assignment: cfg.pts_on_assignment })}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-text-secondary">{de ? "Punkte bei Ableistung" : "Points when done"}</div>
          <input
            type="number"
            min={1}
            max={50}
            step={1}
            className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5"
            value={cfg.pts_on_shift_done}
            disabled={loading}
            onChange={(e) => setCfg((c) => ({ ...c, pts_on_shift_done: Number(e.target.value) }))}
            onBlur={() => save({ pts_on_shift_done: cfg.pts_on_shift_done })}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-text-secondary">{de ? "Cooldown / Tag" : "Cooldown per day"}</div>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5"
            value={cfg.pts_cooldown_per_day}
            disabled={loading}
            onChange={(e) => setCfg((c) => ({ ...c, pts_cooldown_per_day: Number(e.target.value) }))}
            onBlur={() => save({ pts_cooldown_per_day: cfg.pts_cooldown_per_day })}
          />
        </div>
      </div>
      {msg ? <p className="text-xs text-text-secondary">{msg}</p> : null}
    </div>
  );
}
