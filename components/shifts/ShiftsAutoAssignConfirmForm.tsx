"use client";

import type { ReactNode } from "react";
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
  /** i18n key for `window.confirm` message */
  confirmKey?: string;
}) {
  const { locale } = useLocale();
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(t(confirmKey as Parameters<typeof t>[0], locale))) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
