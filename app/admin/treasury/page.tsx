import { cookies } from "next/headers";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import TreasuryUploadForm from "../../../components/TreasuryUploadForm";
import TreasuryEntryForm from "../../../components/TreasuryEntryForm";
import { getCurrentOrganization, getCurrentUserOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import { formatCurrency } from "../../../lib/currency";
import { t, localeFromCookie, LOCALE_COOKIE_NAME } from "../../../lib/i18n";
import { canViewFinance } from "../../../lib/permissions";
import FinanceCategoriesForm from "./FinanceCategoriesForm";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

type TreasuryPageProps = { searchParams?: Promise<{ org?: string }> | { org?: string } };

export default async function TreasuryPage(props: TreasuryPageProps) {
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function"
    ? await (raw as Promise<{ org?: string }>)
    : (raw ?? {}) as { org?: string };
  const orgSlug = searchParams?.org?.trim() || null;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    const loginHref = orgSlug ? `/${orgSlug}/login` : "/";
    return (
      <p className="text-sm text-amber-300">
        Session not recognised. Please <a href={loginHref} className="underline">sign in again</a>.
      </p>
    );
  }

  let orgId: string | null = null; // real organizations.id row
  let orgIdForData: string | null = null; // mapped data org id (legacy-safe)
  if (orgSlug) {
    try {
      const org = await getCurrentOrganization(orgSlug);
      orgId = org.id;
      orgIdForData = getOrgIdForData(orgSlug, org.id);
    } catch {
      orgId = null;
      orgIdForData = null;
    }
  }
  if (!orgId) {
    const userOrg = await getCurrentUserOrganization();
    if (userOrg) {
      orgId = userOrg.id;
      orgIdForData = getOrgIdForData(userOrg.slug, userOrg.id);
    }
  }

  const service = createSupabaseServiceRoleClient();
  let profile: { id: string; role: string; organization_id: string | null } | null = null;
  if (orgIdForData) {
    const { data: profilePrimary } = await service
      .from("profiles")
      .select("id, role, organization_id")
      .eq("auth_user_id", userId)
      .eq("organization_id", orgIdForData)
      .maybeSingle();

    const { data: profileFallback } = (!profilePrimary && orgIdForData !== orgId)
      ? await service
          .from("profiles")
          .select("id, role, organization_id")
          .eq("auth_user_id", userId)
          .eq("organization_id", orgId)
          .maybeSingle()
      : { data: null };

    profile = (profilePrimary ?? profileFallback) as typeof profile;
  }

  if (!profile || !canViewFinance((profile as { role?: any }).role)) {
    return (
      <p className="text-sm text-red-300">
        Access only for authorised roles.
      </p>
    );
  }

  const profileOrgId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  if (!orgIdForData && profileOrgId) orgIdForData = profileOrgId;

  let effectiveOrgSlug = orgSlug;
  let orgSettings: { currency?: string } = {};
  if (orgId) {
    const userOrg = await getCurrentUserOrganization();
    if (!effectiveOrgSlug && userOrg?.slug) effectiveOrgSlug = userOrg.slug;
    const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    orgSettings = (orgRow?.settings as { currency?: string }) ?? {};
  }

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const currencyCode = orgSettings.currency ?? "EUR";
  const localeForCurrency = locale === "de" ? "de-DE" : "en-GB";

  let treasuryQuery = supabase
    .from("treasury_updates")
    .select("amount, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (orgIdForData) treasuryQuery = treasuryQuery.eq("organization_id", orgIdForData);
  const { data: lastUpdate } = await treasuryQuery.maybeSingle();

  let entries: { id: string; date: string; description: string | null; amount_cents: number; type: string }[] = [];
  let categories: { key: string; name: string }[] = [];
  if (orgIdForData) {
    try {
      const { data: entriesData } = await supabase
        .from("treasury_entries")
        .select("id, date, description, amount_cents, type, category")
        .eq("organization_id", orgIdForData)
        .order("date", { ascending: false })
        .limit(50);
      entries = (entriesData ?? []) as typeof entries;
    } catch {
      // Table may not exist yet
    }
    try {
      const { data: catRows } = await supabase
        .from("finance_categories")
        .select("key, name")
        .eq("organization_id", orgIdForData)
        .eq("enabled", true)
        .order("name");
      categories = (catRows ?? []) as typeof categories;
    } catch {
      categories = [];
    }
  }

  const entriesSumCents = entries.reduce((sum, e) => sum + (e.type === "income" ? Number(e.amount_cents) : -Number(e.amount_cents)), 0);
  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const e of entries) {
    const monthKey = e.date.slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    if (e.type === "income") byMonth[monthKey].income += Number(e.amount_cents);
    else byMonth[monthKey].expense += Number(e.amount_cents);
  }
  const monthKeys = Object.keys(byMonth).sort().reverse().slice(0, 6);
  const defaultCellRef = process.env.TREASURY_EXCEL_CELL ?? "M9";

  return (
    <div className="space-y-4">
      {effectiveOrgSlug && (
        <AdminBreadcrumb orgSlug={effectiveOrgSlug} currentLabel="Treasury" />
      )}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">
          {t("finance.balance_label", locale).replace("{currency}", currencyCode)}
        </h2>
        <p className="text-xs text-gray-600">
          You can either{" "}
          <span className="font-semibold">enter the balance manually</span> or update via{" "}
          <span className="font-semibold">Excel (.xlsx)</span>. By default, Excel uses cell{" "}
          <code className="rounded bg-gray-100 px-1">
            {defaultCellRef}
          </code>{" "}
          as the balance – you can change this in the form.
        </p>
        {lastUpdate && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last balance:{" "}
            <span className="font-semibold">
              {formatCurrency(Number(lastUpdate.amount), localeForCurrency, currencyCode)}
            </span>{" "}
            ({new Date(lastUpdate.created_at).toLocaleString(localeForCurrency)})
          </p>
        )}
      </section>

      <section className="card">
        <TreasuryUploadForm organizationId={orgIdForData ?? undefined} defaultCellRef={defaultCellRef} currencyCode={currencyCode} />
        <div className="mt-2 text-xs">
          <a className="text-blue-600 hover:underline dark:text-blue-400" href="/api/treasury/template">
            {t("finance.download_template", locale)}
          </a>
        </div>
      </section>

      {orgIdForData && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("finance.entries_title", locale)}</h2>
            <a
              className="text-xs text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              href={`/api/treasury/export?organization_id=${encodeURIComponent(orgIdForData)}`}
            >
              Export CSV
            </a>
          </div>
          <div className="mt-3">
            <FinanceCategoriesForm
              orgId={orgIdForData}
              initial={categories}
            />
          </div>
          {entries.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("finance.entries_empty", locale)}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-600 dark:text-gray-400">
                    <th className="pb-2 pr-4">{t("finance.entry_date", locale)}</th>
                    <th className="pb-2 pr-4">{t("finance.entry_description", locale)}</th>
                    <th className="pb-2 pr-4">{t("finance.entry_type", locale)}</th>
                    <th className="pb-2 text-right">{t("finance.amount", locale)}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-1.5 pr-4">{e.date}</td>
                      <td className="py-1.5 pr-4">{e.description ?? "—"}</td>
                      <td className="py-1.5 pr-4">{e.type === "income" ? t("finance.entry_type_income", locale) : t("finance.entry_type_expense", locale)}</td>
                      <td className="py-1.5 text-right font-medium">{formatCurrency(Number(e.amount_cents) / 100, localeForCurrency, currencyCode)}</td>
                    </tr>
                  ))}
                  {entries.length > 0 && (
                    <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-600">
                      <td className="py-2 pr-4" colSpan={2}>{t("finance.entries_sum", locale)}</td>
                      <td className="py-2 pr-4">—</td>
                      <td className="py-2 text-right">{formatCurrency(entriesSumCents / 100, localeForCurrency, currencyCode)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      {monthKeys.length > 0 && (
            <details className="mt-3 rounded border border-gray-200 dark:border-gray-600">
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">{t("finance.monthly_summary", locale)}</summary>
              <ul className="list-none border-t border-gray-100 px-2 py-1.5 text-xs dark:border-gray-700">
                {monthKeys.map((key) => {
                  const { income, expense } = byMonth[key];
                  const [y, m] = key.split("-");
                  const label = locale === "de" ? `${m}/${y}` : `${y}-${m}`;
                  return (
                    <li key={key} className="flex justify-between gap-2 py-0.5 text-gray-600 dark:text-gray-400">
                      <span>{label}</span>
                      <span>+{formatCurrency(income / 100, localeForCurrency, currencyCode)} / −{formatCurrency(expense / 100, localeForCurrency, currencyCode)}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
          <TreasuryEntryForm organizationId={orgIdForData} currencyCode={currencyCode} categories={categories} />
        </section>
      )}
    </div>
  );
}
