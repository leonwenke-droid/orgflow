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
      <label className="mb-1 block text-[10px] font-semibold text-gray-700">Team</label>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="min-w-[160px] rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
      >
        <option value="">All teams</option>
        {committees.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
