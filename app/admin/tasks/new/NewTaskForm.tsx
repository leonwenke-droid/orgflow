"use client";

import { useFormState } from "react-dom";
import OwnerSelectWithScope from "../../../../components/OwnerSelectWithScope";
import DueDateTimePicker from "../../../../components/DueDateTimePicker";
import SubmitButtonWithSpinner from "../../../../components/SubmitButtonWithSpinner";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

type CreateTaskState = { errorKey?: string; error?: string } | null;
type CreateTaskAction = (prev: CreateTaskState, formData: FormData) => Promise<CreateTaskState>;

type Committee = { id: string; name: string };
type Member = { id: string; full_name: string; committee_id: string | null; committee_ids: string[] };
type Event = { id: string; name: string };

export default function NewTaskForm({
  action,
  organizationId,
  orgSlug,
  committeeList,
  members,
  eventsList
}: {
  action: CreateTaskAction;
  organizationId?: string;
  orgSlug?: string;
  committeeList: Committee[];
  members: Member[];
  eventsList: Event[];
}) {
  const { locale } = useLocale();
  const [state, formAction] = useFormState(action, null);
  const errorMessage = state?.errorKey ? t(state.errorKey, locale) : state?.error;

  return (
    <form action={formAction} className="space-y-3 text-sm">
      {organizationId ? <input type="hidden" name="organization_id" value={organizationId} /> : null}
      {orgSlug ? <input type="hidden" name="org_slug" value={orgSlug} /> : null}
      {errorMessage && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("tasks.title_label", locale)}
        </label>
        <input
          name="title"
          required
          placeholder={t("placeholders.task_title", locale)}
          className="w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("tasks.description_label", locale)}
        </label>
        <textarea
          name="description"
          rows={3}
          className="w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      {eventsList.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("shifts.event_optional", locale)}
          </label>
          <select
            name="event_id"
            className="w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">{t("shifts.event_none", locale)}</option>
            {eventsList.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}
      {committeeList.length === 0 && (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 dark:text-amber-100 dark:border-amber-600 dark:bg-amber-900/20">
          {t("tasks.no_committees_hint", locale)}
        </p>
      )}
      <OwnerSelectWithScope
        committees={committeeList}
        members={members}
        committeeName={t("dashboard.teams", locale)}
        ownerName={t("tasks.owner_label", locale)}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("tasks.deadline", locale)}
          </label>
          <DueDateTimePicker name="due_at" />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              name="proof_required"
              defaultChecked
              className="rounded border-gray-400"
            />
            {t("tasks.proof_required", locale)}
          </label>
        </div>
      </div>
      <div className="flex items-center">
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" name="claimable" className="rounded border-gray-400" />
          {t("tasks.claimable_label", locale)}
        </label>
      </div>
      <div className="pt-2">
        <SubmitButtonWithSpinner
          className="btn-primary text-xs inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
          loadingLabel={t("tasks.saving", locale)}
        >
          {t("tasks.save", locale)}
        </SubmitButtonWithSpinner>
      </div>
    </form>
  );
}
