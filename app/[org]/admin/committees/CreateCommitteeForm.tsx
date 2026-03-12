"use client";

import { useRouter } from "next/navigation";
import { createCommitteeAction } from "./actions";

type Committee = { id: string; name: string };

export default function CreateCommitteeForm({
  orgSlug
}: {
  orgSlug: string;
  orgId: string;
  committees: Committee[];
}) {
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const name = formData.get("name")?.toString()?.trim();
    if (!name) return;
    const { error } = await createCommitteeAction(orgSlug, name);
    if (error) {
      alert(error);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="mt-6 flex gap-2">
      <input
        type="text"
        name="name"
        placeholder="Neues Komitee (z. B. Dekoration)"
        className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
        required
      />
      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Anlegen
      </button>
    </form>
  );
}
