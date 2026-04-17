"use client";

import { useCallback, useState, type ComponentProps } from "react";
import CreateShiftsForm from "../CreateShiftsForm";
import ModalPortal from "../ModalPortal";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

type CreateShiftsAction = ComponentProps<typeof CreateShiftsForm>["action"];

export default function NewShiftModal({
  action,
  organizationId,
  events,
  engagementEnabled = true,
  allowAutoAssign = true
}: {
  action: CreateShiftsAction;
  organizationId?: string;
  events: { id: string; name: string }[];
  engagementEnabled?: boolean;
  allowAutoAssign?: boolean;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="btnp btn" onClick={() => setOpen(true)}>
        {t("shifts.v2_new_shift", locale)}
      </button>
      {open ? (
        <ModalPortal>
          <div
            className="shifts-page mwrap-portal"
            role="presentation"
            onClick={closeModal}
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-shift-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mhd" id="new-shift-modal-title">
                {t("shifts.v2_new_shift_modal_title", locale)}
              </div>
              <CreateShiftsForm
                variant="modal"
                action={action}
                organizationId={organizationId}
                events={events}
                onCancel={closeModal}
                onSuccess={closeModal}
                engagementEnabled={engagementEnabled}
                allowAutoAssign={allowAutoAssign}
              />
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
