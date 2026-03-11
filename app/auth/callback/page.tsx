import AuthCallbackClient from "./AuthCallbackClient";

/**
 * Callback nach E-Mail-Verifizierung oder Einladungslink.
 * Setzt die Session (token_hash/type oder Hash-Tokens) und leitet zum zugehörigen Dashboard weiter.
 */
export default async function AuthCallbackPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; token_hash?: string; type?: string; code?: string }> | { next?: string; token_hash?: string; type?: string; code?: string };
}) {
  const params = typeof (searchParams as Promise<{ next?: string; token_hash?: string; type?: string; code?: string }>).then === "function"
    ? await (searchParams as Promise<{ next?: string; token_hash?: string; type?: string; code?: string }>)
    : (searchParams as { next?: string; token_hash?: string; type?: string; code?: string });

  const nextUrl = params?.next?.trim() || null;
  const tokenHash = params?.token_hash?.trim() || null;
  const type = params?.type?.trim() || null;
  const code = params?.code?.trim() || null;

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <AuthCallbackClient nextUrl={nextUrl} tokenHash={tokenHash} type={type} code={code} />
    </div>
  );
}
