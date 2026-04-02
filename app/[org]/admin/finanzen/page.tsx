import { cookies } from "next/headers";
import { getRequestLocale } from "../../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import TreasuryUploadForm from "../../../../components/TreasuryUploadForm";
import { getCurrentOrganization, getCurrentUserOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import { formatCurrency } from "../../../../lib/currency";
import { formatTreasuryBalanceDate } from "../../../../lib/formatDate";
import { t } from "../../../../lib/i18n";
import { canViewFinance } from "../../../../lib/permissions";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import FinanceSixMonthChart from "../../../../components/finance/FinanceSixMonthChart";
import FinanceLedgerClient from "../../../../components/finance/FinanceLedgerClient";
import {
  buildLedgerDisplayRows,
  buildSixMonthChartData,
  distinctCategoriesFromEntries,
  sum30dMetrics,
  type TreasuryEntryRow
} from "../../../../lib/financeLedger";
import type { DbRole } from "../../../../types";

export const dynamic = "force-dynamic";

export default async function FinanzenPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug =
    typeof (params as Promise<{ org: string }>).then === "function"
      ? (await (params as Promise<{ org: string }>)).org
      : (params as { org: string }).org;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;
  const locale = await getRequestLocale();
  const localeMoney = locale === "de" ? "de-DE" : "en-GB";

  if (!userId) {
    return (
      <p className="text-sm text-amber-300">
        {t("finance.session_not_recognised", locale)}{" "}
        <a href={`/${orgSlug}/login`} className="underline">
          {t("finance.sign_in_again", locale)}
        </a>
        .
      </p>
    );
  }

  let orgId: string | null = null;
  let orgIdForData: string | null = null;
  try {
    const org = await getCurrentOrganization(orgSlug);
    orgId = org.id;
    orgIdForData = getOrgIdForData(orgSlug, org.id);
  } catch {
    orgId = null;
    orgIdForData = null;
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

    const { data: profileFallback } =
      !profilePrimary && orgIdForData !== orgId
        ? await service
            .from("profiles")
            .select("id, role, organization_id")
            .eq("auth_user_id", userId)
            .eq("organization_id", orgId!)
            .maybeSingle()
        : { data: null };

    profile = (profilePrimary ?? profileFallback) as typeof profile;
  }

  if (!profile || !canViewFinance((profile as { role?: DbRole }).role)) {
    return <p className="text-sm text-red-300">{t("finance.access_denied", locale)}</p>;
  }

  const profileOrgId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  if (!orgIdForData && profileOrgId) orgIdForData = profileOrgId;

  let orgSettings: { currency?: string } = {};
  if (orgId) {
    const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    orgSettings = (orgRow?.settings as { currency?: string }) ?? {};
  }

  const currencyCode = orgSettings.currency ?? "EUR";

  let lastUpdate: { amount: number; created_at: string } | null = null;
  let rawEntries: TreasuryEntryRow[] = [];
  let financeCategoryNames: string[] = [];

  if (orgIdForData) {
    const treasuryQuery = service
      .from("treasury_updates")
      .select("amount, created_at")
      .eq("organization_id", orgIdForData)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: lu } = await treasuryQuery.maybeSingle();
    lastUpdate =
      lu && typeof lu === "object" && "amount" in lu && "created_at" in lu
        ? { amount: Number((lu as { amount: unknown }).amount), created_at: String((lu as { created_at: unknown }).created_at) }
        : null;

    const { data: entriesData } = await service
      .from("treasury_entries")
      .select("id, date, description, amount_cents, type, category")
      .eq("organization_id", orgIdForData)
      .order("date", { ascending: true })
      .order("id", { ascending: true });
    rawEntries = (entriesData ?? []) as TreasuryEntryRow[];

    const { data: catRows } = await service
      .from("finance_categories")
      .select("name")
      .eq("organization_id", orgIdForData)
      .eq("enabled", true);
    financeCategoryNames = [...new Set((catRows ?? []).map((r: { name: string }) => r.name).filter(Boolean))];
  }

  const ledgerRows = buildLedgerDisplayRows(rawEntries);
  const chartMonths = buildSixMonthChartData(rawEntries, locale);
  const { incomeCents, expenseCents, incomeCount, expenseCount } = sum30dMetrics(rawEntries);
  const fromEntries = distinctCategoriesFromEntries(rawEntries);
  const categoryOptions = [...new Set([...fromEntries, ...financeCategoryNames])].sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("dashboard.finance", locale)} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default dark:bg-bg-primary/60">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("finance.metric_balance_title", locale)}
          </p>
          {lastUpdate ? (
            <>
              <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900 dark:text-text-primary md:text-4xl">
                {formatCurrency(Number(lastUpdate.amount), localeMoney, currencyCode)}
              </p>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {t("finance.metric_stand_prefix", locale)}{" "}
                {formatTreasuryBalanceDate(lastUpdate.created_at, locale)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-zinc-400 dark:text-zinc-500">—</p>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default dark:bg-bg-primary/60">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("finance.metric_income_30", locale)}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[#639922] dark:text-green-400 md:text-4xl">
            +{formatCurrency(incomeCents / 100, localeMoney, currencyCode)}
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t("finance.metric_bookings_count", locale).replace("{count}", String(incomeCount))}
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default dark:bg-bg-primary/60">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("finance.metric_expense_30", locale)}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[#E24B4A] dark:text-red-400 md:text-4xl">
            −{formatCurrency(expenseCents / 100, localeMoney, currencyCode)}
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t("finance.metric_bookings_count", locale).replace("{count}", String(expenseCount))}
          </p>
        </div>
      </div>

      <FinanceSixMonthChart title={t("finance.chart_title", locale)} months={chartMonths} />

      {orgIdForData && (
        <FinanceLedgerClient
          initialRows={ledgerRows}
          categoryOptions={categoryOptions}
          organizationId={orgIdForData}
          orgSlug={orgSlug}
          currencyCode={currencyCode}
        />
      )}

      {orgIdForData && (
        <section className="rounded-xl border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default dark:bg-bg-primary/60">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-text-primary">
            {t("finance.update_balance_title", locale)}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("finance.update_balance_subtitle", locale)}
          </p>
          <div className="mt-4">
            <TreasuryUploadForm organizationId={orgIdForData} defaultCellRef="" currencyCode={currencyCode} />
          </div>
          <div className="mt-3 text-xs">
            <a className="text-blue-600 hover:underline dark:text-blue-400" href="/api/treasury/template">
              {t("finance.download_template", locale)}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
