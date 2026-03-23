"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { Button } from "./ui/Button";

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
    if (!confirm(t("materials.delete_confirm", locale))) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await deleteAction(formData);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="inline">
      <input type="hidden" name="materialId" value={materialId} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending} className="text-[10px] font-normal">
        {pending ? "…" : t("common.remove", locale)}
      </Button>
    </form>
  );
}
