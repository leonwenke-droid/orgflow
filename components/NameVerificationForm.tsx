"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = {
  token: string;
  verifyAction: (token: string, name: string) => Promise<{ ok: boolean; message: string } | void>;
};

export default function NameVerificationForm({
  token,
  verifyAction
}: Props) {
  const { locale } = useLocale();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await verifyAction(token, name);

    setLoading(false);

    if (result && !result.ok) {
      setError(result.message);
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {t("members.your_name", locale)}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("members.placeholder_name", locale)}
          className="w-full rounded border border-gray-300 bg-white p-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          autoFocus
          required
          disabled={loading}
        />
      </div>
      {error && (
        <p className="text-xs text-red-300 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary text-xs"
      >
        {loading ? t("common.verifying", locale) : t("common.verify", locale)}
      </button>
    </form>
  );
}
