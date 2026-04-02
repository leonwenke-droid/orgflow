"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { Button } from "../../../components/ui/Button";

type Category = { key: string; name: string };

export default function FinanceCategoriesForm({
  orgId,
  initial
}: {
  orgId: string;
  initial: Category[];
}) {
  const { locale } = useLocale();
  const [cats, setCats] = useState<Category[]>(initial);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: Category[]) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/finance-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, categories: next.map((c) => ({ ...c, enabled: true })) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = String(data.message || "Save failed.");
        if (raw.toLowerCase().includes("finance categories are not initialized")) {
          setMessage(t("finance.categories_table_missing", locale));
        } else {
          setMessage(raw);
        }
        setLoading(false);
        return;
      }
      setCats(next);
      setMessage(t("common.saved", locale));
      setLoading(false);
    } catch {
      setMessage(t("finance.network_error", locale));
      setLoading(false);
    }
  }

  function removeAt(key: string) {
    save(cats.filter((c) => c.key !== key));
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-primary p-4 shadow-sm dark:border-border-default bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary dark:text-text-primary">{t("finance.categories_title", locale)}</p>
          <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">{t("finance.categories_hint", locale)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cats.map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary dark:border-border-default dark:text-text-secondary"
          >
            {c.name}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loading}
              onClick={() => removeAt(c.key)}
              className="min-h-0 px-1 py-0 text-sm leading-none font-normal"
              aria-label={t("common.remove", locale)}
            >
              ×
            </Button>
          </span>
        ))}
        {cats.length === 0 && <span className="text-xs text-text-secondary dark:text-text-muted">{t("finance.categories_empty", locale)}</span>}
      </div>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          const key =
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .slice(0, 40) || `cat-${Date.now()}`;
          save([...cats, { key, name }]);
          setNewName("");
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("finance.category_new_placeholder", locale)}
          className="min-w-[220px] flex-1 rounded border border-border-default bg-bg-primary px-3 py-2 text-xs dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t("common.loading", locale) : t("finance.category_add", locale)}
        </button>
      </form>

      {message && <p className="mt-2 text-xs text-text-secondary dark:text-text-muted">{message}</p>}
    </div>
  );
}
