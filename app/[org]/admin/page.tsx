import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  Users,
  Trophy,
  BarChart3,
  UserCog,
  Layers,
  CheckSquare,
  CalendarClock,
  Package,
  Wallet,
  Gift
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

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);

  const { count: committeeCount } = await supabase
    .from("committees")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);

  const { data: scoreRows } = await supabase
    .from("engagement_scores")
    .select("score")
    .eq("organization_id", orgIdForData);
  const totalScore = (scoreRows ?? []).reduce((sum, r) => sum + (Number((r as { score?: number }).score) || 0), 0);
  const avgScore = (memberCount ?? 0) > 0 ? Math.round(totalScore / (memberCount ?? 1)) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10">
          <AdminBreadcrumb orgSlug={orgSlug} />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Admin
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            {org.name}
          </p>
        </header>

        {/* Stats */}
        <section className="mb-10">
          <h2 className="sr-only">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-100">
                <Users className="h-8 w-8 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Members</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{memberCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-100">
                <Trophy className="h-8 w-8 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Teams</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{committeeCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                <BarChart3 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Avg. Score</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{avgScore}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Areas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={`/${orgSlug}/admin/members`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition group-hover:bg-gray-200">
                <UserCog className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-gray-900">Members</span>
                <p className="text-sm text-gray-600">Manage &amp; import</p>
              </div>
            </Link>
            <Link
              href={`/${orgSlug}/admin/committees`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 transition group-hover:bg-violet-200">
                <Layers className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-violet-600">Teams</span>
                <p className="text-sm text-gray-600">Create &amp; edit</p>
              </div>
            </Link>
            <Link
              href={`/admin/tasks?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 transition group-hover:bg-amber-200">
                <CheckSquare className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-amber-600">Tasks</span>
                <p className="text-sm text-gray-600">Kanban &amp; assignment</p>
              </div>
            </Link>
            <Link
              href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition group-hover:bg-gray-200">
                <CalendarClock className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-gray-900">Shifts</span>
                <p className="text-sm text-gray-600">Plan &amp; assign</p>
              </div>
            </Link>
            <Link
              href={`/admin/materials?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition group-hover:bg-gray-200">
                <Package className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-gray-700">Resources</span>
                <p className="text-sm text-gray-600">Resources &amp; events</p>
              </div>
            </Link>
            <Link
              href={`/admin/treasury?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:bg-emerald-200">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-emerald-600">Treasury</span>
                <p className="text-sm text-gray-600">Finance &amp; upload</p>
              </div>
            </Link>
            <Link
              href={`/${orgSlug}/admin/scores/assign`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:bg-emerald-200">
                <Gift className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 group-hover:text-emerald-600">Assign points</span>
                <p className="text-sm text-gray-600">Individual (events/resources)</p>
              </div>
            </Link>
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

