import { ReactNode } from "react";

/**
 * Layout für alle Routen unter /[org]/ (z. B. /mein-verein/dashboard).
 * Navigation bleibt im Root-Layout; /dashboard und /admin leiten auf die User-Org weiter.
 */
export default function OrgLayout({
  children
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
