import type { ReactNode } from "react";
import { OrgFlowLogoLockup } from "../brand/OrgFlowLogoLockup";

export default function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[min(100dvh,880px)] flex-col items-center justify-center bg-[#fafaf8] px-4 py-12 dark:bg-[#0c0c0b]">
      <div className="mb-8 flex w-full max-w-sm justify-center">
        <OrgFlowLogoLockup href="/" size="md" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
