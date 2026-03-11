import { redirect } from "next/navigation";
import AuthForm from "../../components/AuthForm";

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
    <div className="mx-auto max-w-sm">
      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-cyan-400">
            Sign in
          </h2>
          <p className="mt-1 text-xs text-cyan-400/80">
            Sign in to access your organisation or create a new one.
          </p>
        </div>
        <AuthForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}

