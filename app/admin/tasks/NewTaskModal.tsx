"use client";

import { useCallback, useState, type ComponentProps } from "react";
import NewTaskForm from "./new/NewTaskForm";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

type NewTaskFormProps = ComponentProps<typeof NewTaskForm>;

export default function NewTaskModal({
  action,
  organizationId,
  orgSlug,
  committeeList,
  members,
  eventsList
}: {
  action: NewTaskFormProps["action"];
  organizationId?: string;
  orgSlug?: string;
  committeeList: NewTaskFormProps["committeeList"];
  members: NewTaskFormProps["members"];
  eventsList: NewTaskFormProps["eventsList"];
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="btn-primary px-3 py-1.5 text-xs font-medium shadow-sm"
        onClick={() => setOpen(true)}
      >
        + {t("cta.create_task", locale)}
      </button>
      {open ? (
        <div className="shifts-page">
          <div className="mwrap" role="presentation" onClick={closeModal}>
            <div
              className="modal task-form-modal-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-task-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mhd" id="new-task-modal-title">
                {t("tasks.new_task", locale)}
              </div>
              <NewTaskForm
                variant="modal"
                action={action}
                organizationId={organizationId}
                orgSlug={orgSlug}
                committeeList={committeeList}
                members={members}
                eventsList={eventsList}
                onCancel={closeModal}
                onSuccess={closeModal}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
