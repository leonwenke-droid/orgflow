"use client";

import { useState } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import MemberTaskRow, { type MemberTaskRowTask } from "./MemberTaskRow";
import { Button } from "./ui/Button";

type Props = {
  doneTasks: MemberTaskRowTask[];
  locale: Locale;
  orgSlug: string;
  myProfileId: string | null;
  nameById: Record<string, string>;
  canClaim: boolean;
  claimTaskAction: (formData: FormData) => Promise<void>;
  offerTaskAction: (formData: FormData) => Promise<void>;
};

export default function TasksDoneSection({
  doneTasks,
  locale,
  orgSlug,
  myProfileId,
  nameById,
  canClaim,
  claimTaskAction,
  offerTaskAction
}: Props) {
  const [show, setShow] = useState(false);

  if (doneTasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("tasks.done_section_title", locale)}{" "}
          <span className="font-normal text-gray-500 dark:text-gray-400">({doneTasks.length})</span>
        </h2>
        <Button type="button" variant="secondary" size="sm" onClick={() => setShow((v) => !v)}>
          {show ? t("tasks.toggle_done_hide", locale) : t("tasks.toggle_done_show", locale)}
        </Button>
      </div>
      {show ? (
        <ul className="mt-3 space-y-3">
          {doneTasks.map((task) => (
            <MemberTaskRow
              key={task.id}
              task={task}
              locale={locale}
              orgSlug={orgSlug}
              myProfileId={myProfileId}
              nameById={nameById}
              canClaim={canClaim}
              claimTaskAction={claimTaskAction}
              offerTaskAction={offerTaskAction}
              isCompleted
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
