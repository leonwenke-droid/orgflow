import Link from "next/link";

type Props = {
  orgSlug: string;
  /** z.B. "Schichten", "Punkte vergeben" */
  currentLabel?: string;
};

/** Breadcrumb: Dashboard → Admin → [aktuelles Modul] */
export default function AdminBreadcrumb({ orgSlug, currentLabel }: Props) {
  return (
    <nav className="mb-4 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link
        href={`/${orgSlug}/dashboard`}
        className="text-cyan-400 transition hover:text-cyan-300"
      >
        Dashboard
      </Link>
      <span className="text-cyan-500/60" aria-hidden>·</span>
      <Link
        href={`/${orgSlug}/admin`}
        className="text-cyan-400 transition hover:text-cyan-300"
      >
        Admin
      </Link>
      {currentLabel && (
        <>
          <span className="text-cyan-500/60" aria-hidden>·</span>
          <span className="text-cyan-200">{currentLabel}</span>
        </>
      )}
    </nav>
  );
}
