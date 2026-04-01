"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import { createResourceAction, updateResourceStatusAction } from "./actions";

type Resource = {
  id: string;
  item_description: string;
  size: string;
  status: string;
  quantity: number;
  quantity_unit: string | null;
  category: string | null;
  responsible_user_id: string | null;
  needed_by: string | null;
  source: string | null;
  event_id: string | null;
  event_name: string | null;
  created_at: string;
};

type Props = {
  orgSlug: string;
  orgId: string;
  resources: Resource[];
  nameById: Record<string, string>;
  profiles: { id: string; full_name: string }[];
  events: { id: string; name: string }[];
  /** When set (e.g. deep-link from event detail), list is scoped to this event. */
  eventFilter?: { id: string; name: string } | null;
};

const STATUS_FILTERS = ["alle", "offen", "beschafft", "geliehen"] as const;

function statusTag(status: string) {
  if (status === "beschafft") return "tag tag-green";
  if (status === "geliehen") return "tag tag-blue";
  return "tag tag-amber";
}

export default function ResourcesClient({
  orgSlug,
  orgId,
  resources: initial,
  nameById,
  profiles,
  events,
  eventFilter = null,
}: Props) {
  const { locale } = useLocale();
  const [filter, setFilter] = useState<string>("alle");
  const [showForm, setShowForm] = useState(false);
  const [resources, setResources] = useState(initial);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  useEffect(() => {
    setResources(initial);
  }, [initial]);

  const scopedResources = useMemo(
    () =>
      eventFilter?.id
        ? resources.filter((r) => r.event_id === eventFilter.id)
        : resources,
    [resources, eventFilter?.id]
  );

  const filtered = useMemo(
    () =>
      filter === "alle"
        ? scopedResources
        : scopedResources.filter((r) => r.status === filter),
    [scopedResources, filter]
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("organization_id", orgId);
    const result = await createResourceAction(orgSlug, fd);
    if (result.error) {
      setFormMsg(result.error);
    } else {
      setShowForm(false);
      window.location.reload();
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const result = await updateResourceStatusAction(orgSlug, id, newStatus);
    if (!result.error) {
      setResources((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    }
  }

  return (
    <>
      {eventFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-light bg-brand-light/30 px-3 py-2 text-sm">
          <span className="text-gray-800 dark:text-gray-200">
            {locale === "de" ? "Veranstaltung:" : "Event:"}{" "}
            <strong>{eventFilter.name}</strong>
          </span>
          <Link
            href={`/${orgSlug}/admin/materials`}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {locale === "de" ? "Alle Ressourcen anzeigen" : "Show all resources"}
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              filter === f
                ? "bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {f === "alle"
              ? locale === "de"
                ? "Alle"
                : "All"
              : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary ml-auto"
        >
          + {locale === "de" ? "Ressource" : "Resource"}
        </button>
      </div>

      {showForm && (
        <div className="card p-4">
          <div className="section-label">
            {locale === "de" ? "Neue Ressource" : "New resource"}
          </div>
          {formMsg && (
            <p className="mb-2 text-xs text-red-600">{formMsg}</p>
          )}
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <input
              name="item_description"
              required
              placeholder={
                locale === "de" ? "Bezeichnung…" : "Description…"
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              name="category"
              placeholder={
                locale === "de" ? "Kategorie (z.B. Catering)" : "Category"
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <input
                name="quantity"
                type="number"
                min={1}
                defaultValue={1}
                className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                name="quantity_unit"
                placeholder={locale === "de" ? "Stück" : "pcs"}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <select
              name="size"
              defaultValue="medium"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
            <select
              name="responsible_user_id"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">
                {locale === "de" ? "Verantwortlich…" : "Responsible…"}
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <input
              name="needed_by"
              type="date"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            {events.length > 0 && (
              <select
                name="event_id"
                defaultValue={eventFilter?.id ?? ""}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">
                  {locale === "de"
                    ? "Event (optional)"
                    : "Event (optional)"}
                </option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            )}
            <select
              name="source"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">{locale === "de" ? "Quelle…" : "Source…"}</option>
              <option value="gekauft">{locale === "de" ? "Gekauft" : "Bought"}</option>
              <option value="geliehen">{locale === "de" ? "Geliehen" : "Borrowed"}</option>
              <option value="vorhanden">{locale === "de" ? "Vorhanden" : "Existing"}</option>
            </select>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="btn-primary">
                {locale === "de" ? "Erstellen" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                {locale === "de" ? "Abbrechen" : "Cancel"}
              </button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500">
            {t("empty.resources", locale)}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    {locale === "de" ? "Bezeichnung" : "Name"}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    {locale === "de" ? "Kategorie" : "Category"}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    {locale === "de" ? "Menge" : "Qty"}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    {locale === "de" ? "Verantwortlich" : "Responsible"}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    {locale === "de" ? "Benötigt bis" : "Needed by"}
                  </th>
                  <th className="w-32 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {r.item_description}
                      </span>
                      {r.event_name && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({r.event_name})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.category || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.quantity}
                      {r.quantity_unit ? ` ${r.quantity_unit}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        onChange={(e) =>
                          handleStatusChange(r.id, e.target.value)
                        }
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${
                          r.status === "beschafft"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : r.status === "geliehen"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        <option value="offen">Offen</option>
                        <option value="beschafft">Beschafft</option>
                        <option value="geliehen">Geliehen</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.responsible_user_id
                        ? nameById[r.responsible_user_id] ?? "—"
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.needed_by || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.source && (
                        <span className="tag tag-compact tag-neutral">{r.source}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
