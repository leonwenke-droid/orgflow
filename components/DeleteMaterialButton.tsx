"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = {
  materialId: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export default function DeleteMaterialButton({ materialId, deleteAction }: Props) {
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirm("Remove entry and associated points?")) return;
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
        className="text-[10px] text-gray-500 hover:text-red-600 disabled:opacity-50"
      >
        {pending ? "…" : t("common.remove", locale)}
      </button>
    </form>
  );
}
