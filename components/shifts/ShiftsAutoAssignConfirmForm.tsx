"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import ModalPortal from "../ModalPortal";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
export default function ShiftsAutoAssignConfirmForm({
  action,
  children,
  className,
  confirmKey = "shifts.confirm_auto_assign"
}: {
  action: (formData: FormData) => Promise<void>;
  children?: ReactNode;
  className?: string;
  /** i18n key for confirmation modal body */
  confirmKey?: string;
}) {
  const { locale } = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) {
      allowSubmitRef.current = false;
      return;
    }
    e.preventDefault();
    setOpen(true);
  }

  function cancelModal() {
    setOpen(false);
  }

  function confirmModal() {
    allowSubmitRef.current = true;
    setOpen(false);
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  return (
    <>
      <form ref={formRef} action={action} className={className} onSubmit={handleSubmit}>
        {children}
      </form>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
            onClick={cancelModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-confirm-title"
          >
            <div
              className="w-full max-w-md rounded-t-2xl border border-border-default bg-bg-primary p-4 shadow-2xl sm:rounded-xl dark:border-border-default dark:bg-bg-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="batch-confirm-title" className="text-sm font-semibold text-text-primary">
                {t("shifts.batch_confirm_title", locale)}
              </h3>
              <p className="mt-2 text-sm text-text-secondary">{t(confirmKey as Parameters<typeof t>[0], locale)}</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-3 dark:border-border-default">
                <button type="button" className="btn" onClick={cancelModal}>
                  {t("common.cancel", locale)}
                </button>
                <button type="button" className="btnp btn" onClick={confirmModal}>
                  {t("shifts.batch_confirm_submit", locale)}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
