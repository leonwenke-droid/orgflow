import Link from "next/link";
import { getAllOrganizations } from "../lib/getOrganization";
import { getRequestLocale } from "../lib/localeServer";
import { t } from "../lib/i18n";
import {
  CheckCircle2,
  Users,
  Calendar,
  Wallet,
  BarChart3,
  Zap,
  ArrowRight,
  Shield,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const locale = await getRequestLocale();
  let organizations: Awaited<ReturnType<typeof getAllOrganizations>> = [];
  try {
    organizations = await getAllOrganizations();
  } catch {
    // Supabase not configured or unavailable – show empty list
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            OrgFlow
          </h1>
          <div className="flex gap-3 text-sm">
            <Link
              href="#features"
              className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t("landing.nav_features", locale)}
            </Link>
            <Link
              href="#pricing"
              className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t("landing.nav_pricing", locale)}
            </Link>
            <Link
              href="/login?redirectTo=/dashboard"
              className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t("landing.nav_sign_in", locale)}
            </Link>
            <Link
              href="/create-organisation"
              className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              {t("landing.cta_start_org", locale)}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
          {t("landing.hero_title", locale)}
        </h2>
        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          {t("landing.hero_subtitle", locale)}
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          <Link
            href="/create-organisation"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            {t("landing.cta_start_org", locale)}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#organisations"
            className="inline-flex items-center gap-2 px-2 py-3 text-base font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("landing.hero_secondary", locale)}
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-600 mb-8">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            {t("landing.bullet_shifts", locale)}
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            {t("landing.bullet_tasks", locale)}
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            {t("landing.bullet_finance", locale)}
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            {t("landing.bullet_engagement", locale)}
          </span>
        </div>
        <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left sm:text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              {t("landing.trust_rbac", locale)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
              {t("landing.trust_audit", locale)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
              {t("landing.trust_privacy", locale)}
            </span>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            {t("landing.problem_title", locale)}
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-12">
            {t("landing.problem_subtitle", locale)}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Users className="h-10 w-10 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.problem_teams_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.problem_teams_body", locale)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Calendar className="h-10 w-10 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.problem_shifts_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.problem_shifts_body", locale)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Wallet className="h-10 w-10 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.problem_finance_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.problem_finance_body", locale)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            {t("landing.features_title", locale)}
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-16">
            {t("landing.features_subtitle", locale)}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.feature_tasks_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.feature_tasks_body", locale)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Calendar className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.feature_shifts_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.feature_shifts_body", locale)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Wallet className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.feature_finance_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.feature_finance_body", locale)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            {t("landing.how_title", locale)}
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-16">
            {t("landing.how_subtitle", locale)}
          </p>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.step1_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.step1_body", locale)}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.step2_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.step2_body", locale)}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.step3_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.step3_body", locale)}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mx-auto mb-4">
                4
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t("landing.step4_title", locale)}</h4>
              <p className="text-gray-600 text-sm">{t("landing.step4_body", locale)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            {t("landing.pricing_title", locale)}
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-16">
            {t("landing.pricing_subtitle", locale)}
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="rounded-xl border-2 border-gray-200 bg-white p-8 shadow-sm">
              <h4 className="font-bold text-gray-900 text-lg mb-1">{t("landing.plan_free", locale)}</h4>
              <p className="text-3xl font-bold text-gray-900 mb-6">
                {t("landing.price_free_value", locale)}
                <span className="text-base font-normal text-gray-500">{t("landing.price_period", locale)}</span>
              </p>
              <ul className="space-y-3 text-gray-600 text-sm mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.free_limit_members", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.free_tasks_shifts", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.free_one_team", locale)}
                </li>
              </ul>
              <Link
                href="/create-organisation"
                className="block w-full text-center rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t("landing.btn_get_started", locale)}
              </Link>
            </div>
            <div className="rounded-xl border-2 border-blue-600 bg-white p-8 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                {t("landing.plan_popular", locale)}
              </div>
              <h4 className="font-bold text-gray-900 text-lg mb-1">{t("landing.plan_team", locale)}</h4>
              <p className="text-3xl font-bold text-gray-900 mb-6">
                {t("landing.price_team_value", locale)}
                <span className="text-base font-normal text-gray-500">{t("landing.price_period", locale)}</span>
              </p>
              <ul className="space-y-3 text-gray-600 text-sm mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.team_limit_members", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.team_all_features", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.team_unlimited_teams", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.team_email_support", locale)}
                </li>
              </ul>
              <Link
                href="/create-organisation"
                className="block w-full text-center rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t("landing.btn_start_trial", locale)}
              </Link>
            </div>
            <div className="rounded-xl border-2 border-gray-200 bg-white p-8 shadow-sm">
              <h4 className="font-bold text-gray-900 text-lg mb-1">{t("landing.plan_pro", locale)}</h4>
              <p className="text-3xl font-bold text-gray-900 mb-6">
                {t("landing.price_pro_value", locale)}
                <span className="text-base font-normal text-gray-500">{t("landing.price_period", locale)}</span>
              </p>
              <ul className="space-y-3 text-gray-600 text-sm mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.pro_unlimited_members", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.pro_all_team", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.pro_priority_support", locale)}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  {t("landing.pro_custom_subdomain", locale)}
                </li>
              </ul>
              <Link
                href="/create-organisation"
                className="block w-full text-center rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t("landing.btn_contact_sales", locale)}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {t("landing.bottom_cta_title", locale)}
          </h3>
          <p className="text-lg text-blue-100 mb-8">{t("landing.bottom_cta_subtitle", locale)}</p>
          <Link
            href="/create-organisation"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-sm hover:bg-gray-100 transition-colors"
          >
            {t("landing.cta_start_org", locale)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Organisations */}
      <section id="organisations" className="py-16 md:py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-xl md:text-2xl font-semibold text-gray-900 text-center mb-8">
            {t("landing.orgs_title", locale)}
          </h3>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-gray-600">
            {t("landing.orgs_subtitle", locale)}
          </p>
          {organizations.length === 0 ? (
            <p className="text-center text-gray-500 text-sm">{t("landing.orgs_empty", locale)}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/${org.slug}/login`}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-200 hover:shadow-md transition-all flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {org.school_short || org.school_name || org.name}
                      </h4>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {org.school_name || org.name}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                      {t("landing.org_badge_active", locale)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">
                    {org.school_name || org.name}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              {t("landing.footer_copyright", locale).replace("{year}", String(new Date().getFullYear()))}
            </span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-gray-700">
              {t("landing.footer_privacy", locale)}
            </Link>
            <Link href="/terms" className="hover:text-gray-700">
              {t("landing.footer_terms", locale)}
            </Link>
            <Link href="/imprint" className="hover:text-gray-700">
              {t("landing.footer_imprint", locale)}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
