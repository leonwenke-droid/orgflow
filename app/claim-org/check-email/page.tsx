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
      <h1 className="text-xl font-bold text-blue-100">Check email</h1>
      <p className="mt-4 text-sm text-blue-300">
        Wir haben dir eine Verifikations-E-Mail geschickt.
      </p>
      <p className="mt-2 text-sm text-blue-300/90">
        Please check your inbox (including spam folder) and click the link in the email to confirm your account.
      </p>
      <p className="mt-4 text-sm text-blue-400/90">
        Sobald du das erledigt hast, kannst du hier fortfahren:
      </p>
      <Link
        href={safeNext}
        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Weiter zum Einrichten
      </Link>
    </div>
  );
}
