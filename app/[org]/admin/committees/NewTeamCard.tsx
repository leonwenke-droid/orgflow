"use client";

import { useState } from "react";
import CreateCommitteeForm from "./CreateCommitteeForm";

export default function NewTeamCard({
  orgSlug,
  orgId,
  committees,
}: {
  orgSlug: string;
  orgId: string;
  committees: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300"
      >
        + Neues Team anlegen
      </button>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="section-label mb-0">Neues Team</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>
      <CreateCommitteeForm orgSlug={orgSlug} orgId={orgId} committees={committees} />
    </div>
  );
}
