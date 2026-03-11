import LeadSetupClient from "./LeadSetupClient";

export default async function LeadSetupPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string; token_hash?: string; type?: string }> | { next?: string; token_hash?: string; type?: string };
}) {
  const params = typeof (searchParams as Promise<{ next?: string; token_hash?: string; type?: string }>)?.then === "function"
    ? await (searchParams as Promise<{ next?: string; token_hash?: string; type?: string }>)
    : (searchParams as { next?: string; token_hash?: string; type?: string }) ?? {};
  const nextRaw = (params.next ?? "").trim();
  const nextUrl = nextRaw.startsWith("/") ? nextRaw : "/";
  const tokenHash = (params.token_hash ?? "").trim() || null;
  const type = (params.type ?? "").trim() || null;

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <LeadSetupClient nextUrl={nextUrl} tokenHash={tokenHash} type={type} />
    </div>
  );
}

