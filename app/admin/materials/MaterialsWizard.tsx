"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import AddMaterialForm, { type ResourceCategoryOption } from "../../../components/AddMaterialForm";
import ResourceCategoriesForm from "./ResourceCategoriesForm";

type Profile = { id: string; full_name: string };
type EventOption = { id: string; name: string };
type Category = { key: string; name: string; points: number; examples?: string | null };

type AddMaterialAction = (
  prev: { error?: string; errorKey?: string; success?: boolean } | null,
  formData: FormData
) => Promise<{ error?: string; errorKey?: string; success?: boolean }>;

export default function MaterialsWizard({
  orgId,
  orgSlug,
  resourceCategoriesInitial,
  profiles,
  addMaterialProcurement,
  events
}: {
  orgId: string | null;
  orgSlug?: string | null;
  resourceCategoriesInitial: ResourceCategoryOption[] | null;
  profiles: Profile[];
  addMaterialProcurement: AddMaterialAction;
  events: EventOption[];
}) {
  const { locale } = useLocale();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const categoriesForForm: Category[] = resourceCategoriesInitial?.length
    ? resourceCategoriesInitial.map((c) => ({
        key: c.value,
        name: c.label,
        points: c.points,
        examples: c.examples ?? undefined
      }))
    : [
        { key: "small", name: t("resources.size_small", locale), points: 5 },
        { key: "medium", name: t("resources.size_medium", locale), points: 10 },
        { key: "large", name: t("resources.size_large", locale), points: 15 }
      ];

  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: t("materials.wizard_step_categories", locale) },
    { n: 2, label: t("materials.wizard_step_record", locale) },
    { n: 3, label: t("materials.wizard_step_history", locale) }
  ];

  return (
    <section id="record-material" className="card">
      <h2 className="mb-3 text-sm font-semibold text-text-secondary dark:text-text-secondary">
        {t("materials.wizard_title", locale)}
      </h2>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t("materials.wizard_title", locale)}>
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              step === s.n
                ? "bg-blue-600 text-white"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary dark:bg-bg-primary dark:text-text-primary dark:hover:bg-bg-tertiary"
            }`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </nav>

      <div className={step === 1 ? "block" : "hidden"}>
        {orgId ? (
          <div className="mb-4">
            <ResourceCategoriesForm orgId={orgId} initial={categoriesForForm} />
          </div>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("materials.wizard_no_org_categories", locale)}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            onClick={() => setStep(2)}
          >
            {t("materials.wizard_next", locale)}
          </button>
        </div>
      </div>

      <div className={step === 2 ? "block" : "hidden"}>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
            onClick={() => setStep(1)}
          >
            {t("materials.wizard_prev", locale)}
          </button>
        </div>
        <AddMaterialForm
          profiles={profiles}
          addMaterialProcurement={addMaterialProcurement}
          resourceCategories={resourceCategoriesInitial ?? undefined}
          events={events}
          organizationIdHidden={orgId ?? undefined}
          orgSlugHidden={orgSlug ?? undefined}
        />
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            onClick={() => setStep(3)}
          >
            {t("materials.wizard_next", locale)}
          </button>
        </div>
      </div>

      <div className={step === 3 ? "block" : "hidden"}>
        <p className="text-sm text-text-secondary dark:text-text-muted">
          {t("materials.wizard_history_intro", locale)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
            onClick={() => setStep(2)}
          >
            {t("materials.wizard_prev", locale)}
          </button>
          <a
            href="#materials-history"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {t("materials.wizard_go_history", locale)}
          </a>
        </div>
      </div>
    </section>
  );
}
