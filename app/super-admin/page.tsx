import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Settings,
  Users,
  TrendingUp
} from "lucide-react";
import {
  isSuperAdmin,
  getAllOrganizations
} from "../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../lib/supabaseServer";
import DeleteOrgButton from "./DeleteOrgButton";
import SetupLinkBlock from "./SetupLinkBlock";

export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

export default async function SuperAdminDashboard() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/super-admin");
  }

  if (!(await isSuperAdmin())) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-cyan-100">Keine Berechtigung</h1>
        <p className="mt-3 text-sm text-cyan-300">
          Du hast keine Berechtigung für den Super-Admin-Bereich. Dieser Bereich ist nur für den technischen Administrator.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          Zur Startseite
        </Link>
      </div>
    );
  }

  const organizations = await getAllOrganizations();

  const service = createSupabaseServiceRoleClient();
  const { count: totalUsers } = await service
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: activeOrgs } = await service
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-cyan-100">
              Super-Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-cyan-300">
              Verwaltung aller Organisationen
            </p>
          </div>
          <Link
            href="/super-admin/organizations/new"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            <Plus className="h-4 w-4" />
            Neue Organisation
          </Link>
        </div>

        {/* Kennzahlen */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-card border border-cyan-500/30 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-600">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-cyan-300">Gesamt Nutzer</p>
                <p className="text-2xl font-bold text-cyan-100">
                  {totalUsers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card border border-cyan-500/30 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-cyan-300">Aktive Organisationen</p>
                <p className="text-2xl font-bold text-cyan-100">
                  {activeOrgs || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card border border-cyan-500/30 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-cyan-300">Systemstatus</p>
                <p className="text-2xl font-bold text-green-400">
                  Online
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Organisationsliste */}
        <div className="overflow-hidden rounded-lg bg-card border border-cyan-500/30">
          <div className="border-b border-cyan-500/30 px-6 py-4">
            <h2 className="text-lg font-semibold text-cyan-100">
              Alle Organisationen
            </h2>
          </div>
          <div className="divide-y divide-cyan-500/30">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="px-6 py-4 hover:bg-cyan-500/5 transition-colors"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-base font-semibold text-cyan-100">
                        {org.name}
                      </h3>
                      <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {org.year}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-cyan-300">
                      <span>Slug: {org.slug}</span>
                      {org.subdomain && (
                        <span>Subdomain: {org.subdomain}.abiorga.app</span>
                      )}
                      {org.school_city && <span>{org.school_city}</span>}
                    </div>
                    {org.setup_token && !org.setup_token_used_at && (
                      <SetupLinkBlock
                        org={{
                          id: org.id,
                          name: org.name,
                          slug: org.slug,
                          setup_token: org.setup_token,
                          setup_token_used_at: org.setup_token_used_at,
                        }}
                        initialLink={
                          baseUrl
                            ? `${baseUrl.replace(/\/$/, "")}/claim-org?token=${encodeURIComponent(org.setup_token)}`
                            : null
                        }
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/${org.slug}/onboarding`}
                      className="inline-flex items-center rounded-md bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      Einrichtung
                    </Link>
                    <Link
                      href={`/${org.slug}/dashboard`}
                      className="inline-flex items-center rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={`/${org.slug}/admin`}
                      className="inline-flex items-center rounded-md bg-cyan-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                    >
                      Admin-Board
                    </Link>
                    <DeleteOrgButton orgId={org.id} orgName={org.name} />
                  </div>
                </div>
              </div>
            ))}
            {organizations.length === 0 && (
              <p className="px-6 py-6 text-sm text-cyan-300">
                Noch keine Organisationen angelegt.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

