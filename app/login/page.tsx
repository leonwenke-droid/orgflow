import { redirect } from "next/navigation";
import AuthForm from "../../components/AuthForm";
import AuthPageShell from "../../components/auth/AuthPageShell";

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
  const isValidRedirect = redirectTo && allowedRedirects.some((p) => redirectTo === p || redirectTo.startsWith(p + "/"));
  if (!isValidRedirect) {
    redirect("/");
  }

  return (
    <AuthPageShell>
      <div className="auth-card space-y-5">
        <div>
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-sub">
            Sign in to access your organisation or create a new one.
          </p>
        </div>
        <AuthForm redirectTo={redirectTo} />
      </div>
    </AuthPageShell>
  );
}

