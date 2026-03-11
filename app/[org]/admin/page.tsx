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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-cyan-950/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10">
          <AdminBreadcrumb orgSlug={orgSlug} />
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Admin
          </h1>
          <p className="mt-2 text-lg text-cyan-300/90">
            {org.name}
          </p>
        </header>

        {/* Stats */}
        <section className="mb-10">
          <h2 className="sr-only">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-5 rounded-2xl border border-cyan-500/20 bg-card/80 p-6 shadow-lg shadow-cyan-950/20 backdrop-blur-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-md">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-cyan-400/80">Members</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white">{memberCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 rounded-2xl border border-cyan-500/20 bg-card/80 p-6 shadow-lg shadow-cyan-950/20 backdrop-blur-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-md">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-cyan-400/80">Teams</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white">{committeeCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 rounded-2xl border border-cyan-500/20 bg-card/80 p-6 shadow-lg shadow-cyan-950/20 backdrop-blur-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-cyan-400/80">Avg. Score</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white">{avgScore}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cyan-400/90">
            Areas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={`/${orgSlug}/admin/members`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 transition group-hover:bg-cyan-500/30">
                <UserCog className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Members</span>
                <p className="text-sm text-cyan-400/80">Manage &amp; import</p>
              </div>
            </Link>
            <Link
              href={`/${orgSlug}/admin/committees`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 transition group-hover:bg-violet-500/30">
                <Layers className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Teams</span>
                <p className="text-sm text-cyan-400/80">Create &amp; edit</p>
              </div>
            </Link>
            <Link
              href={`/admin/tasks?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 transition group-hover:bg-amber-500/30">
                <CheckSquare className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Tasks</span>
                <p className="text-sm text-cyan-400/80">Kanban &amp; assignment</p>
              </div>
            </Link>
            <Link
              href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 transition group-hover:bg-blue-500/30">
                <CalendarClock className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Shifts</span>
                <p className="text-sm text-cyan-400/80">Plan &amp; assign</p>
              </div>
            </Link>
            <Link
              href={`/admin/materials?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-500/20 text-slate-400 transition group-hover:bg-slate-500/30">
                <Package className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Resources</span>
                <p className="text-sm text-cyan-400/80">Resources &amp; events</p>
              </div>
            </Link>
            <Link
              href={`/admin/treasury?org=${encodeURIComponent(orgSlug)}`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-green-400 transition group-hover:bg-green-500/30">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Treasury</span>
                <p className="text-sm text-cyan-400/80">Finance &amp; upload</p>
              </div>
            </Link>
            <Link
              href={`/${orgSlug}/admin/scores/assign`}
              className="group flex items-center gap-4 rounded-xl border border-cyan-500/25 bg-card/60 p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 transition group-hover:bg-emerald-500/30">
                <Gift className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-cyan-100 group-hover:text-white">Assign points</span>
                <p className="text-sm text-cyan-400/80">Individual (events/resources)</p>
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

