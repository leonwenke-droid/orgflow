"use client";

import { useState } from "react";
import { deleteOrganizationAction } from "./actions";
import { useLocale } from "../../components/LocaleProvider";
import { t } from "../../lib/i18n";
import { Button } from "../../components/ui/Button";

export default function DeleteOrgButton({
  orgId,
  orgName
}: {
  orgId: string;
  orgName: string;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await deleteOrganizationAction(orgId, orgName, confirmation);
    setLoading(false);
    if (result.errorKey) {
      setError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setConfirmation("");
    window.location.reload();
  }

  return (
    <>
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)} className="text-xs font-semibold">
        {t("common.remove", locale)}
      </Button>
      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 rounded-lg border border-red-500/30 bg-card p-4"
        >
          <p className="text-sm font-medium text-blue-100">
            Organisation wirklich entfernen?
          </p>
          <p className="mt-1 text-xs text-blue-400/80">
            To confirm, please enter the exact organization name:{" "}
            <strong className="text-blue-200">{orgName}</strong>
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={orgName}
            className="mt-3 w-full rounded border border-blue-500/30 bg-background px-3 py-2 text-sm text-blue-100 placeholder:text-blue-500/50"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={loading || confirmation.trim() !== orgName}
              className="text-xs font-semibold"
            >
              {loading ? "Removing…" : "Permanently remove"}
            </Button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmation(""); setError(null); }}
              className="rounded border border-blue-500/40 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/10"
            >
              {t("common.cancel", locale)}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
