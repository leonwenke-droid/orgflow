"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Committee = { id: string; name: string };

export default function CommitteeFilter({
  committees,
  className = ""
}: {
  committees: Committee[];
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("committee") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("committee", value);
    } else {
      params.delete("committee");
    }
    router.push(`/admin/tasks?${params.toString()}`);
  }

  return (
    <div className={className}>
      <label className="text-[10px] font-semibold text-cyan-400 block mb-1">Komitee</label>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded border border-cyan-500/30 bg-card/60 px-2 py-1.5 text-xs text-cyan-200 min-w-[160px]"
      >
        <option value="">Alle Komitees</option>
        {committees.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
