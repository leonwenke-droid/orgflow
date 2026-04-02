import Link from "next/link";

type Props = {
  orgSlug: string;
  /** z.B. "Schichten", "Punkte vergeben" */
  currentLabel?: string;
  /** false = Dashboard → current (e.g. Gesamtübersicht ohne Admin-Kontext) */
  showAdminSegment?: boolean;
};

/** Breadcrumb: Dashboard → Admin → [aktuelles Modul], oder Dashboard → [Modul] */
export default function AdminBreadcrumb({ orgSlug, currentLabel, showAdminSegment = true }: Props) {
  return (
    <nav className="mb-4 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link
        href={`/${orgSlug}/dashboard`}
        className="text-text-secondary transition hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
      >
        Dashboard
      </Link>
      {showAdminSegment ? (
        <>
          <span className="text-text-muted dark:text-text-secondary" aria-hidden>·</span>
          <Link
            href={`/${orgSlug}/admin`}
            className="text-text-secondary transition hover:text-text-primary dark:text-text-muted dark:hover:text-text-primary"
          >
            Admin
          </Link>
        </>
      ) : null}
      {currentLabel && (
        <>
          <span className="text-text-muted dark:text-text-secondary" aria-hidden>·</span>
          <span className="text-text-primary dark:text-text-primary">{currentLabel}</span>
        </>
      )}
    </nav>
  );
}
