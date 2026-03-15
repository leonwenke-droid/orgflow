import { redirect } from "next/navigation";

/**
 * /[org]/admin/shifts → redirect to /admin/shifts?org=... (canonical admin shifts URL with org in query).
 */
export default async function AdminShiftsRedirect({
  params,
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const org = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  redirect(`/admin/shifts?org=${encodeURIComponent(org)}`);
}
