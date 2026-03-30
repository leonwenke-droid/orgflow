import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OrgRootPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });

  redirect(`/${params.org}/dashboard`);
}
