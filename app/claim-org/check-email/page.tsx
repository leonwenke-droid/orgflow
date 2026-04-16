import Link from "next/link";
import AuthPageShell from "../../../components/auth/AuthPageShell";

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
    <AuthPageShell>
      <div className="auth-card space-y-5 text-center">
        <div>
          <h1 className="auth-title">Check email</h1>
          <p className="auth-sub">
            Wir haben dir eine Verifikations-E-Mail geschickt. Bitte prüfe auch den Spam-Ordner und klicke den Link,
            um dein Konto zu bestätigen.
          </p>
        </div>
        <Link href={safeNext} className="btn-primary inline-flex w-full justify-center py-2.5 text-sm">
          Weiter zum Einrichten
        </Link>
        <p className="text-[11px] text-text-muted">
          Tipp: Wenn du keine E‑Mail bekommst, versuche es nach 1–2 Minuten erneut oder nutze eine andere Adresse.
        </p>
      </div>
    </AuthPageShell>
  );
}
