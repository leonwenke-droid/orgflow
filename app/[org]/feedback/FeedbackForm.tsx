"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitMemberFeatureRequest } from "./actions";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { locale } = useLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? t("feedback.submitting", locale) : t("feedback.submit", locale)}
    </button>
  );
}

export default function FeedbackForm({ orgSlug }: { orgSlug: string }) {
  const { locale } = useLocale();
  const bound = submitMemberFeatureRequest.bind(null, orgSlug);
  const [state, formAction] = useFormState(bound, {});

  return (
    <form action={formAction} className="mt-3 space-y-3">
      {state?.errorKey ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {t(state.errorKey as "feedback.error_title", locale)}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-green-700 dark:text-green-400">{t("feedback.thanks", locale)}</p>
      ) : null}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("feedback.title_label", locale)}
        </label>
        <input
          name="title"
          required
          className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("feedback.description_label", locale)}
        </label>
        <textarea
          name="description"
          rows={4}
          className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
