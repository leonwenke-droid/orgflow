import Link from "next/link";

export default async function ClaimOrgCheckEmailPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }> | { next?: string };
}) {
  const params = typeof (searchParams as Promise<{ next?: string }>).then === "function"
    ? await (searchParams as Promise<{ next?: string }>)
    : (searchParams as { next?: string });
  const nextUrl = params?.next?.trim();
  const safeNext = nextUrl && nextUrl.startsWith("/") ? nextUrl : "/";

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold text-cyan-100">E-Mail prüfen</h1>
      <p className="mt-4 text-sm text-cyan-300">
        Wir haben dir eine Verifikations-E-Mail geschickt.
      </p>
      <p className="mt-2 text-sm text-cyan-300/90">
        Bitte prüfe dein Postfach (auch den Spam-Ordner) und klicke auf den Link in der E-Mail, um deinen Account zu bestätigen.
      </p>
      <p className="mt-4 text-sm text-cyan-400/90">
        Sobald du das erledigt hast, kannst du hier fortfahren:
      </p>
      <Link
        href={safeNext}
        className="mt-6 inline-block rounded-lg bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-700"
      >
        Weiter zum Einrichten
      </Link>
    </div>
  );
}
