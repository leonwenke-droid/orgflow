import LeadSetupClient from "../lead-setup/LeadSetupClient";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }> | { next?: string };
}) {
  const params = typeof (searchParams as Promise<{ next?: string }> )?.then === "function"
    ? await (searchParams as Promise<{ next?: string }>)
    : (searchParams as { next?: string }) ?? {};
  const nextRaw = (params.next ?? "/").trim();
  const nextUrl = nextRaw.startsWith("/") ? nextRaw : "/";

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <LeadSetupClient nextUrl={nextUrl} />
    </div>
  );
}
