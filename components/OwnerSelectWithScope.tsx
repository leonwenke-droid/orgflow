"use client";

import { useState, useMemo } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import MemberSelect from "./MemberSelect";

type Committee = { id: string; name: string };
type Member = {
  id: string;
  full_name: string;
  committee_id: string | null;
  committee_ids?: string[];
};

type Props = {
  committees: Committee[];
  members: Member[];
  committeeName: string;
  ownerName: string;
};

export default function OwnerSelectWithScope({
  committees,
  members,
  committeeName,
  ownerName
}: Props) {
  const { locale } = useLocale();
  const [committeeId, setCommitteeId] = useState<string>("");
  const [scope, setScope] = useState<"committee" | "year">("year");

  const ownerOptions = useMemo(() => {
    if (scope === "year") return members.map((m) => ({ id: m.id, full_name: m.full_name }));
    if (!committeeId) return [];
    return members
      .filter(
        (m) =>
          m.committee_id === committeeId ||
          (m.committee_ids && m.committee_ids.includes(committeeId))
      )
      .map((m) => ({ id: m.id, full_name: m.full_name }));
  }, [scope, committeeId, members]);

  return (
    <div className="space-y-4">
      <input type="hidden" name="committee_id" value={scope === "year" ? "" : committeeId} />
      <div>
        <span className="mb-2 block text-[11px] font-medium text-text-secondary">
          {t("tasks.owner_scope_heading", locale)}
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-primary">
            <input
              type="radio"
              name="owner_scope"
              value="year"
              checked={scope === "year"}
              onChange={() => setScope("year")}
              className="border-border-default text-[var(--blue-mid)] focus:ring-[var(--blue-mid)]"
            />
            {t("tasks.owner_scope_all_members", locale)}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-primary">
            <input
              type="radio"
              name="owner_scope"
              value="committee"
              checked={scope === "committee"}
              onChange={() => setScope("committee")}
              className="border-border-default text-[var(--blue-mid)] focus:ring-[var(--blue-mid)]"
            />
            {t("tasks.owner_scope_team_only", locale)}
          </label>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
          {t("tasks.owner_scope_hint", locale)}
        </p>
      </div>

      {scope === "committee" && (
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">
            {committeeName}
          </label>
          <select
            required={scope === "committee"}
            value={committeeId}
            onChange={(e) => setCommitteeId(e.target.value)}
            className="ui-input w-full p-2.5 text-xs"
          >
            <option value="">{t("tasks.owner_select_team_first", locale)}</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">{ownerName}</label>
        <MemberSelect
          name="owner_id"
          options={ownerOptions}
          placeholder={
            scope === "committee" && !committeeId
              ? t("tasks.owner_select_team_first", locale)
              : t("tasks.member_select_placeholder", locale)
          }
          className="w-full"
        />
      </div>
    </div>
  );
}
