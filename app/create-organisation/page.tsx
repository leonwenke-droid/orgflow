import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import CreateOrganisationClient from "./CreateOrganisationClient";

export const dynamic = "force-dynamic";

export default async function CreateOrganisationPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="mx-auto max-w-md p-8 rounded-xl border border-gray-200 bg-white shadow-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900">
            Sign in to create your organisation
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            You need to be signed in to create an organisation. Sign in or create an account to continue.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/login?redirectTo=${encodeURIComponent("/create-organisation")}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CreateOrganisationClient />;
}
