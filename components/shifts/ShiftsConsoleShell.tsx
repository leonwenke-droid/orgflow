import type { ReactNode } from "react";

export default function ShiftsConsoleShell({ children }: { children: ReactNode }) {
  return (
    <div className="shifts-page shifts-console">
      <div className="wrap">{children}</div>
    </div>
  );
}
