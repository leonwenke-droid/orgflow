"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AddMemberForm from "./AddMemberForm";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

export default function AddMemberModal({
  orgSlug,
  committees,
  disabledReason
}: {
  orgSlug: string;
  committees: { id: string; name: string }[];
  disabledReason?: string | null;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`btn-primary ${disabledReason ? "pointer-events-none opacity-50" : ""}`}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={() => setOpen(true)}
      >
        + {t("members.add_member_btn", locale)}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
              onClick={() => setOpen(false)}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border-subtle bg-bg-primary shadow-xl dark:border-border-default sm:rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3 dark:border-border-default">
                  <h2 id={titleId} className="text-base font-semibold text-text-primary">
                    {t("members.add_member_btn", locale)}
                  </h2>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                    aria-label={t("common.close", locale)}
                  >
                    ✕
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
                  <AddMemberForm
                    orgSlug={orgSlug}
                    committees={committees}
                    disabledReason={disabledReason}
                    variant="modal"
                    onCancel={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
