import type { ReactNode } from "react";
import { OrgFlowLogoLockup } from "../brand/OrgFlowLogoLockup";

export default function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell relative left-1/2 w-screen -translate-x-1/2 bg-[var(--paper)] px-4 py-12 text-[var(--ink)] dark:bg-[#0c0c0b] dark:text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center">
      <div className="mb-8 flex w-full max-w-sm justify-center">
        <OrgFlowLogoLockup href="/" size="md" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
