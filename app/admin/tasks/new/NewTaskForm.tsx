"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import OwnerSelectWithScope from "../../../../components/OwnerSelectWithScope";
import DueDateTimePicker from "../../../../components/DueDateTimePicker";
import SubmitButtonWithSpinner from "../../../../components/SubmitButtonWithSpinner";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import type { CreateTaskState } from "../createTaskAction";

type CreateTaskAction = (prev: CreateTaskState, formData: FormData) => Promise<CreateTaskState>;

type Committee = { id: string; name: string };
type Member = { id: string; full_name: string; committee_id: string | null; committee_ids: string[] };
type Event = { id: string; name: string };

const sectionShell =
  "rounded-xl border border-border-subtle/90 bg-bg-secondary/70 p-4 shadow-sm dark:border-white/[0.12] dark:bg-[rgba(15,17,24,0.72)] sm:p-5";
const sectionTitle = "text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted";
const fieldLabel = "mb-1.5 block text-[11px] font-medium text-text-secondary";

export default function NewTaskForm({
  action,
  organizationId,
  orgSlug,
  committeeList,
  members,
  eventsList,
  variant = "default",
  onCancel,
  onSuccess
}: {
  action: CreateTaskAction;
  organizationId?: string;
  orgSlug?: string;
  committeeList: Committee[];
  members: Member[];
  eventsList: Event[];
  variant?: "default" | "modal";
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [state, formAction] = useFormState(action, null);
  const errorMessage = state?.errorKey ? t(state.errorKey, locale) : state?.error;

  useEffect(() => {
    if (!state?.success || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const org = params.get("org");
    const event = params.get("event");
    const committee = params.get("committee");
    const q = params.get("q");
    const next = new URLSearchParams();
    if (org) next.set("org", org);
    if (event) next.set("event", event);
    if (committee) next.set("committee", committee);
    if (q) next.set("q", q);
    const qs = next.toString();
    router.replace(qs ? `/admin/tasks?${qs}` : "/admin/tasks");
    router.refresh();
    onSuccess?.();
  }, [state?.success, router, onSuccess]);

  const sections = (
    <div className={variant === "modal" ? "space-y-5" : "space-y-6"}>
      <section className={`${sectionShell} space-y-4`}>
        <h3 className={sectionTitle}>{t("tasks.section_basic", locale)}</h3>
        <div>
          <label className={fieldLabel} htmlFor="new-task-title">
            {t("tasks.title_label", locale)}
          </label>
          <input
            id="new-task-title"
            name="title"
            required
            placeholder={t("placeholders.task_title", locale)}
            className="ui-input w-full p-2.5 text-sm"
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="new-task-description">
            {t("tasks.description_label", locale)}
          </label>
          <textarea
            id="new-task-description"
            name="description"
            rows={4}
            placeholder={t("placeholders.task_description", locale)}
            className="ui-input min-h-[5.5rem] w-full resize-y p-2.5 text-sm"
          />
        </div>
        {eventsList.length > 0 && (
          <div>
            <label className={fieldLabel} htmlFor="new-task-event">
              {t("shifts.event_optional", locale)}
            </label>
            <select id="new-task-event" name="event_id" className="ui-input w-full p-2.5 text-sm">
              <option value="">{t("shifts.event_none", locale)}</option>
              {eventsList.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className={`${sectionShell} space-y-4`}>
        <h3 className={sectionTitle}>{t("tasks.section_responsibility", locale)}</h3>
        {committeeList.length === 0 && (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 dark:border-amber-600/50 dark:bg-amber-950/30">
            {t("tasks.no_committees_hint", locale)}
          </p>
        )}
        <OwnerSelectWithScope
          committees={committeeList}
          members={members}
          committeeName={t("dashboard.teams", locale)}
          ownerName={t("tasks.owner_label", locale)}
        />
      </section>

      <section className={`${sectionShell} space-y-4`}>
        <h3 className={sectionTitle}>{t("tasks.section_due", locale)}</h3>
        <DueDateTimePicker name="due_at" layout="inline" />
      </section>

      <section className={`${sectionShell} space-y-4`}>
        <h3 className={sectionTitle}>{t("tasks.section_options", locale)}</h3>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-text-primary">
          <input
            type="checkbox"
            name="proof_required"
            defaultChecked
            className="mt-0.5 rounded border-border-default"
          />
          <span>{t("tasks.proof_required", locale)}</span>
        </label>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-text-primary">
            <input type="checkbox" name="claimable" className="mt-0.5 rounded border-border-default" />
            <span>{t("tasks.claimable_label", locale)}</span>
          </label>
          <p className="pl-7 text-[11px] leading-relaxed text-text-muted">{t("tasks.claimable_subhint", locale)}</p>
        </div>
      </section>
    </div>
  );

  if (variant === "modal") {
    return (
      <form action={formAction} className="new-task-modal-form flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="modal" value="1" />
        {organizationId ? <input type="hidden" name="organization_id" value={organizationId} /> : null}
        {orgSlug ? <input type="hidden" name="org_slug" value={orgSlug} /> : null}
        <div className="modal-scroll flex-1 overflow-y-auto px-5 py-5">
          {errorMessage && (
            <p className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">{errorMessage}</p>
          )}
          {sections}
        </div>
        <div className="mft">
          <button type="button" className="btn" onClick={onCancel}>
            {t("common.cancel", locale)}
          </button>
          <SubmitButtonWithSpinner
            className="btnp inline-flex min-h-[40px] min-w-[160px] items-center justify-center gap-2 rounded-[var(--sp-radius-sm)] px-4 text-xs font-semibold disabled:pointer-events-none disabled:opacity-70"
            loadingLabel={t("tasks.saving", locale)}
          >
            {t("tasks.save", locale)}
          </SubmitButtonWithSpinner>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-6 text-sm">
      {organizationId ? <input type="hidden" name="organization_id" value={organizationId} /> : null}
      {orgSlug ? <input type="hidden" name="org_slug" value={orgSlug} /> : null}
      {errorMessage && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      {sections}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <SubmitButtonWithSpinner
          className="btn-primary inline-flex min-h-[40px] items-center justify-center px-5 text-xs disabled:pointer-events-none disabled:opacity-70"
          loadingLabel={t("tasks.saving", locale)}
        >
          {t("tasks.save", locale)}
        </SubmitButtonWithSpinner>
      </div>
    </form>
  );
}
