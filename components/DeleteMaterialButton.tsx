"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  materialId: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export default function DeleteMaterialButton({ materialId, deleteAction }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirm("Erfassung und zugehörige Punkte entfernen?")) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await deleteAction(formData);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="inline">
      <input type="hidden" name="materialId" value={materialId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[10px] text-cyan-400/70 hover:text-red-400 disabled:opacity-50"
      >
        {pending ? "…" : "Entfernen"}
      </button>
    </form>
  );
}
