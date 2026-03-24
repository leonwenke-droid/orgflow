import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import AuthForm from "../../components/AuthForm";
import CreateOrganisationClient from "./CreateOrganisationClient";

export const dynamic = "force-dynamic";

export default async function CreateOrganisationPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-background-dark">
        <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h1 className="text-center text-xl font-semibold text-gray-900 dark:text-gray-100">
            Start your organisation
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in with an existing account, or create one — then you can set up your organisation here.
          </p>
          <div className="mt-6">
            <AuthForm redirectTo="/create-organisation" />
          </div>
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-500">
            <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <CreateOrganisationClient />;
}
