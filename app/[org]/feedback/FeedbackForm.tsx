"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitMemberFeatureRequest } from "./actions";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

type FeedbackType = "idea" | "bug" | "question";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { locale } = useLocale();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary disabled:opacity-60"
    >
      {pending ? t("feedback.submitting", locale) : t("feedback.submit", locale)}
    </button>
  );
}

function pill(active: boolean) {
  return `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-white text-gray-900 shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-white/60 hover:text-gray-900"
  }`;
}

export default function FeedbackForm({ orgSlug }: { orgSlug: string }) {
  const { locale } = useLocale();
  const bound = submitMemberFeatureRequest.bind(null, orgSlug);
  const [state, formAction] = useFormState(bound, {});
  const [type, setType] = useState<FeedbackType>("idea");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const typeLabel = useMemo(() => {
    if (type === "bug") return locale === "en" ? "Bug" : "Bug";
    if (type === "question") return locale === "en" ? "Question" : "Frage";
    return locale === "en" ? "Idea" : "Idee";
  }, [type, locale]);

  useEffect(() => {
    if (state?.ok) {
      setTitle("");
      setDescription("");
      setType("idea");
    }
  }, [state?.ok]);

  return (
    <form
      action={formAction}
      className="mt-3 space-y-3"
      onSubmit={() => {
        // keep optimistic UI responsive; state comes from server action
      }}
    >
      <input type="hidden" name="type" value={type} />
      {state?.errorKey ? (
        <p className="text-sm text-danger-dark" role="alert">
          {t(state.errorKey as "feedback.error_title", locale)}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success-dark">
          {t("feedback.thanks", locale)}{" "}
          <span className="text-gray-500">
            {locale === "en" ? `(${typeLabel})` : `(${typeLabel})`}
          </span>
        </p>
      ) : null}

      <div>
        <div className="section-label">{locale === "en" ? "Type" : "Typ"}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={pill(type === "idea")} onClick={() => setType("idea")}>
            {locale === "en" ? "Idea" : "Idee"}
          </button>
          <button type="button" className={pill(type === "bug")} onClick={() => setType("bug")}>
            {locale === "en" ? "Bug" : "Bug"}
          </button>
          <button type="button" className={pill(type === "question")} onClick={() => setType("question")}>
            {locale === "en" ? "Question" : "Frage"}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          {t("feedback.title_label", locale)}
        </label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          placeholder={locale === "en" ? "Short summary…" : "Kurze Zusammenfassung…"}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          {t("feedback.description_label", locale)}
        </label>
        <textarea
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          placeholder={locale === "en" ? "Details (optional)..." : "Details (optional)…"}
        />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        <span className="text-xs text-gray-500">
          {locale === "en" ? "Goes directly to the team backlog." : "Landet direkt im Team-Backlog."}
        </span>
      </div>
    </form>
  );
}
