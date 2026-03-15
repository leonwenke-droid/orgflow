"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommitteeAction } from "./actions";
import Link from "next/link";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

type Committee = { id: string; name: string };

export default function CreateCommitteeForm({
  orgSlug
}: {
  orgSlug: string;
  orgId: string;
  committees: Committee[];
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const [limitError, setLimitError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLimitError(null);
    setOtherError(null);
    const name = formData.get("name")?.toString()?.trim();
    if (!name) return;
    const result = await createCommitteeAction(orgSlug, name);
    if (result.errorKey) {
      setOtherError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      if (result.error.includes("limit")) {
        setLimitError(result.error);
      } else {
        setOtherError(result.error);
      }
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mt-6 flex flex-col gap-2">
      {otherError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <p className="font-medium">{otherError}</p>
        </div>
      )}
      {limitError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <p className="font-medium">{limitError}</p>
          <Link href="/#pricing" className="mt-2 inline-block text-blue-600 underline hover:text-blue-700 dark:text-blue-400">
            View pricing & upgrade →
          </Link>
        </div>
      )}
      <div className="flex gap-2">
      <input
        type="text"
        name="name"
        placeholder="New team (e.g. Decoration)"
        className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
        required
      />
      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Create
      </button>
      </div>
    </form>
  );
}
