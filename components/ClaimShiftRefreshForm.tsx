"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Server action that claims the shift (no redirect on success). */
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
};

/**
 * Wraps a claim form so the current route refreshes after a successful server action,
 * updating slot counts without a full page reload.
 */
export default function ClaimShiftRefreshForm({ action, children, className }: Props) {
  const router = useRouter();

  return (
    <form
      className={className}
      action={async (formData) => {
        await action(formData);
        router.refresh();
      }}
    >
      {children}
    </form>
  );
}
