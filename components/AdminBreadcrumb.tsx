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
        className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        Dashboard
      </Link>
      {showAdminSegment ? (
        <>
          <span className="text-gray-400 dark:text-gray-500" aria-hidden>·</span>
          <Link
            href={`/${orgSlug}/admin`}
            className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Admin
          </Link>
        </>
      ) : null}
      {currentLabel && (
        <>
          <span className="text-gray-400 dark:text-gray-500" aria-hidden>·</span>
          <span className="text-gray-900 dark:text-gray-100">{currentLabel}</span>
        </>
      )}
    </nav>
  );
}
