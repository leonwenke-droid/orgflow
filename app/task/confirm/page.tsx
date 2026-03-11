import { redirect } from "next/navigation";

type Props = {
  searchParams: { token?: string };
};

export default async function TaskConfirmRedirectPage({ searchParams }: Props) {
  const { token } = searchParams;

  if (!token) {
    redirect("/");
  }

  redirect(`/task/${token}`);
}
