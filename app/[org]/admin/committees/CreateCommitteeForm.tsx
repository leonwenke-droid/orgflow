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
        className="flex-1 rounded border border-cyan-500/30 bg-background px-3 py-2 text-cyan-100 placeholder:text-cyan-500/50"
        required
      />
      <button
        type="submit"
        className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
      >
        Anlegen
      </button>
    </form>
  );
}
