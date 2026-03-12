import Link from "next/link";

export default function AdminForbidden({
  orgSlug,
  orgName
}: {
  orgSlug: string;
  orgName: string;
}) {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold text-gray-900">Keine Berechtigung</h1>
      <p className="mt-3 text-sm text-gray-600">
        You do not have permission for the admin area of {orgName}. Only admins and team leads have access.
      </p>
      <Link
        href={`/${orgSlug}/dashboard`}
        className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Zum Dashboard
      </Link>
    </div>
  );
}
