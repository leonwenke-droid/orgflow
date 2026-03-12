import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  Users,
  UsersRound,
  CheckSquare,
  CalendarDays,
  Package,
  Wallet,
  Trophy
} from "lucide-react";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../lib/getOrganization";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "./AdminForbidden";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import EngagementScoresBlock from "./EngagementScoresBlock";

export default async function AdminDashboard({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  if (!(await isOrgAdmin(orgIdForData))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const authClient = createServerComponentClient({ cookies });
  const {
    data: { session }
  } = await authClient.auth.getSession();
  const currentAuthUserId = session?.user?.id ?? null;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-dark">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10">
          <AdminBreadcrumb orgSlug={orgSlug} />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground-dark sm:text-4xl">
            Admin
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-muted">
            {org.name}
          </p>
        </header>

        {/* Module cards */}
        <section className="mb-10">
          <h2 className="sr-only">Modules</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { href: `/${orgSlug}/admin/members`, icon: Users, title: "Members", description: "Invite and manage organisation members" },
              { href: `/${orgSlug}/admin/committees`, icon: UsersRound, title: "Teams", description: "Create teams and assign team leads" },
              { href: `/${orgSlug}/admin/tasks`, icon: CheckSquare, title: "Tasks", description: "Manage tasks across teams" },
              { href: `/${orgSlug}/admin/shifts`, icon: CalendarDays, title: "Shifts", description: "Plan shifts and auto-assign members" },
              { href: `/${orgSlug}/admin/materials`, icon: Package, title: "Resources", description: "Track materials and procurement" },
              { href: `/${orgSlug}/admin/treasury`, icon: Wallet, title: "Finance", description: "Manage treasury and transactions" },
              { href: `/${orgSlug}/admin/scores/assign`, icon: Trophy, title: "Engagement", description: "Assign points and view leaderboard" }
            ].map(({ href, icon: Icon, title, description }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:bg-card-dark dark:hover:border-blue-700"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-gray-800">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-foreground-dark">{title}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-muted">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Engagement Scores */}
        <section>
          <EngagementScoresBlock orgSlug={orgSlug} currentAuthUserId={currentAuthUserId} />
        </section>
      </div>
    </div>
  );
}

