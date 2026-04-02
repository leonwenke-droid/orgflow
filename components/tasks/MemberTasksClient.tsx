"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import type { MemberTaskRowTask } from "../MemberTaskRow";
import MemberTaskRow from "../MemberTaskRow";
import TasksDoneSection from "../TasksDoneSection";

type Filter = "all" | "in_arbeit" | "offen";

export default function MemberTasksClient({
  orgSlug,
  orgName,
  locale,
  mine,
  claimable,
  done,
  nameById,
  myProfileId,
  canClaim,
  claimTaskAction,
  offerTaskAction,
}: {
  orgSlug: string;
  orgName: string;
  locale: Locale;
  mine: MemberTaskRowTask[];
  claimable: MemberTaskRowTask[];
  done: MemberTaskRowTask[];
  nameById: Record<string, string>;
  myProfileId: string | null;
  canClaim: boolean;
  claimTaskAction: (formData: FormData) => Promise<void>;
  offerTaskAction: (formData: FormData) => Promise<void>;
}) {
  const sp = useSearchParams();
  const initialAction = (sp?.get("taskAction") ?? "").trim();

  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);

  const filteredMine = useMemo(() => {
    if (filter === "all") return mine;
    return mine.filter((t) => t.status === filter);
  }, [mine, filter]);

  const filteredClaimable = useMemo(() => {
    if (filter === "all") return claimable;
    return claimable.filter((t) => t.status === filter);
  }, [claimable, filter]);

  const pillClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-bg-primary text-text-primary shadow-sm"
        : "bg-bg-secondary text-text-secondary hover:bg-bg-primary/60 hover:text-text-primary"
    }`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header>
        <h1 className="page-title">{t("dashboard.tasks", locale)}</h1>
        <p className="page-sub">{orgName}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter("all")} className={pillClass(filter === "all")}>
            {t("finance.filter_all", locale)}
          </button>
          <button
            type="button"
            onClick={() => setFilter("in_arbeit")}
            className={pillClass(filter === "in_arbeit")}
          >
            {t("tasks.status_in_progress", locale)}
          </button>
          <button type="button" onClick={() => setFilter("offen")} className={pillClass(filter === "offen")}>
            {t("tasks.status_open", locale)}
          </button>
        </div>
        <button type="button" onClick={() => setShowDone((v) => !v)} className="btn-secondary">
          {showDone ? t("tasks.toggle_done_hide", locale) : t("tasks.toggle_done_show", locale)}
        </button>
      </div>

      {initialAction === "claimed" && (
        <div className="card p-4">
          <p className="text-sm text-success-dark">{t("tasks.claim_success", locale)}</p>
        </div>
      )}
      {initialAction === "offered" && (
        <div className="card p-4">
          <p className="text-sm text-success-dark">{t("tasks.offer_success", locale)}</p>
        </div>
      )}
      {initialAction === "error" && (
        <div className="card p-4">
          <p className="text-sm text-danger-dark">{t("tasks.complete_error", locale)}</p>
        </div>
      )}

      <section className="card">
        <div className="p-4">
          <div className="section-label">{t("tasks.my_tasks_section_title", locale)}</div>
          {filteredMine.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("tasks.no_open_tasks", locale)}</p>
          ) : (
            <ul className="space-y-2">
              {filteredMine.map((task) => (
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
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <div className="p-4">
          <div className="section-label">{t("tasks.open_claimable", locale)}</div>
          {filteredClaimable.length === 0 ? (
            <p className="text-sm text-text-secondary">—</p>
          ) : (
            <ul className="space-y-2">
              {filteredClaimable.map((task) => (
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
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {showDone && (
        <TasksDoneSection
          doneTasks={done}
          locale={locale}
          orgSlug={orgSlug}
          myProfileId={myProfileId}
          nameById={nameById}
          canClaim={canClaim}
          claimTaskAction={claimTaskAction}
          offerTaskAction={offerTaskAction}
        />
      )}
    </div>
  );
}

