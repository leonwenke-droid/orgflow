import { redirect } from "next/navigation";
import AuthPageShell from "../../components/auth/AuthPageShell";
import AuthLoginRegisterCard from "../../components/auth/AuthLoginRegisterCard";

/**
 * Nur noch für Super-Admin genutzt. Jahrgangs-Login erfolgt über /[org]/login.
 * Ohne redirectTo=/super-admin → zur Landingpage.
 */
export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string }> | { redirectTo?: string };
}) {
  const q = typeof (searchParams as Promise<{ redirectTo?: string }>)?.then === "function"
    ? await (searchParams as Promise<{ redirectTo?: string }>)
    : (searchParams ?? {}) as { redirectTo?: string };
  const redirectTo = q?.redirectTo?.trim();

  const allowedRedirects = ["/super-admin", "/create-organisation", "/dashboard"];
  const isValidRedirect =
    redirectTo &&
    allowedRedirects.some(
      (p) => redirectTo === p || redirectTo.startsWith(p + "/") || redirectTo.startsWith(p + "?")
    );
  if (!isValidRedirect) {
    redirect("/");
  }

  return (
    <AuthPageShell>
      <AuthLoginRegisterCard redirectTo={redirectTo} orgName={null} />
    </AuthPageShell>
  );
}

