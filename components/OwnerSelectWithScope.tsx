"use client";

import { useState, useMemo } from "react";
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
    <div className="space-y-3">
      <input type="hidden" name="committee_id" value={scope === "year" ? "" : committeeId} />
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          Responsible person from
        </label>
        <div className="flex flex-wrap gap-3 mb-1.5">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="radio"
              name="owner_scope"
              checked={scope === "committee"}
              onChange={() => setScope("committee")}
              className="rounded border-gray-400"
            />
            Selected team only
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="radio"
              name="owner_scope"
              checked={scope === "year"}
              onChange={() => setScope("year")}
              className="rounded border-gray-400"
            />
            All members
          </label>
        </div>
        {scope === "committee" && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              {committeeName} (required)
            </label>
            <select
              required={scope === "committee"}
              value={committeeId}
              onChange={(e) => setCommitteeId(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white p-2 text-xs"
            >
              <option value="">Please select team…</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="mb-1.5 text-[10px] text-gray-500">
          With "Selected team only", only members assigned to that team are shown (primary or additional).
        </p>
        <MemberSelect
          name="owner_id"
          options={ownerOptions}
          placeholder={scope === "committee" && !committeeId ? "Select team first…" : "Enter or select name…"}
        />
      </div>
    </div>
  );
}
