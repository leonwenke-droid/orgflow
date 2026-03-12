import { redirect } from "next/navigation";

export default async function AdminTasksRedirect({
  params,
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const org = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  redirect(`/admin/tasks?org=${encodeURIComponent(org)}`);
}
