import Link from "next/link";
import { getAllOrganizations } from "../lib/getOrganization";
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
              Features
            </Link>
            <Link
              href="#pricing"
              className="px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/create-organisation"
              className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Start your organisation
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-20 md:py-28 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
          Organise your team, tasks and events in one place.
        </h2>
        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          OrgFlow helps organisations coordinate volunteers, tasks and shifts
          effortlessly.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          <Link
            href="/create-organisation"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Start your organisation
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#organisations"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View organisations
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Automatic shift assignment
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Task management with token links
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Treasury & Excel import
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Engagement tracking
          </span>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            Coordination is hard
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Schools, sports clubs, volunteer groups and event crews struggle with
            spreadsheets, WhatsApp groups and scattered tools. OrgFlow brings
            everything together.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <Users className="h-10 w-10 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Scattered teams</h4>
              <p className="text-gray-600 text-sm">
                Members in different groups, no single source of truth.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <Calendar className="h-10 w-10 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Shift chaos</h4>
              <p className="text-gray-600 text-sm">
                Manual scheduling, unfair distribution, last-minute swaps.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <Wallet className="h-10 w-10 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Finance opacity</h4>
              <p className="text-gray-600 text-sm">
                Excel files, unclear balances, audit headaches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            Everything you need
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-16">
            Tasks, shifts, teams, resources, finances and engagement — all in
            one platform.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Task management</h4>
              <p className="text-gray-600 text-sm">
                Kanban boards, token-based confirmation links, proof uploads.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Calendar className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Shift planning</h4>
              <p className="text-gray-600 text-sm">
                Auto-assignment, fair distribution, setup/teardown slots.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Users className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Teams & members</h4>
              <p className="text-gray-600 text-sm">
                Organise committees, invite members, assign roles.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Zap className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Resources</h4>
              <p className="text-gray-600 text-sm">
                Track material procurement, events and contributions.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <Wallet className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Treasury</h4>
              <p className="text-gray-600 text-sm">
                Balance tracking, Excel import, audit trail.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <BarChart3 className="h-8 w-8 text-blue-600 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Engagement score</h4>
              <p className="text-gray-600 text-sm">
                Fair distribution, points for tasks, shifts and resources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            How it works
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-16">
            Get started in minutes.
          </p>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Create organisation</h4>
              <p className="text-gray-600 text-sm">
                Name your org, choose type (school, club, etc.)
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Add teams</h4>
              <p className="text-gray-600 text-sm">
                Create teams (e.g. Finance, Events, Logistics)
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Invite members</h4>
              <p className="text-gray-600 text-sm">
                Send invite links or email invites
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center mx-auto mb-4">
                4
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Start coordinating</h4>
              <p className="text-gray-600 text-sm">
                Create tasks, plan shifts, track engagement
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-4">
            Pricing
          </h3>
          <p className="text-lg text-gray-600 text-center max-w-2xl mx-auto mb-16">
            Simple plans for every organisation.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="rounded-xl border-2 border-gray-200 bg-white p-8 shadow-sm">
              <h4 className="font-bold text-gray-900 text-lg mb-1">Free</h4>
              <p className="text-3xl font-bold text-gray-900 mb-6">
                €0<span className="text-base font-normal text-gray-500">/mo</span>
              </p>
              <ul className="space-y-3 text-gray-600 text-sm mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Up to 10 members
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Basic tasks & shifts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  1 team
                </li>
              </ul>
              <Link
                href="/create-organisation"
                className="block w-full text-center rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Get started
              </Link>
            </div>
            <div className="rounded-xl border-2 border-blue-600 bg-white p-8 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                Popular
              </div>
              <h4 className="font-bold text-gray-900 text-lg mb-1">Team</h4>
              <p className="text-3xl font-bold text-gray-900 mb-6">
                €19<span className="text-base font-normal text-gray-500">/mo</span>
              </p>
              <ul className="space-y-3 text-gray-600 text-sm mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Up to 50 members
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  All features
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Unlimited teams
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Email support
                </li>
              </ul>
              <Link
                href="/create-organisation"
                className="block w-full text-center rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start free trial
              </Link>
            </div>
            <div className="rounded-xl border-2 border-gray-200 bg-white p-8 shadow-sm">
              <h4 className="font-bold text-gray-900 text-lg mb-1">Pro</h4>
              <p className="text-3xl font-bold text-gray-900 mb-6">
                €49<span className="text-base font-normal text-gray-500">/mo</span>
              </p>
              <ul className="space-y-3 text-gray-600 text-sm mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Unlimited members
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  All Team features
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  Custom subdomain
                </li>
              </ul>
              <Link
                href="/create-organisation"
                className="block w-full text-center rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to organise your team?
          </h3>
          <p className="text-lg text-blue-50 mb-8">
            Join schools, sports clubs, volunteer groups and event crews already
            using OrgFlow.
          </p>
          <Link
            href="/create-organisation"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-sm hover:bg-gray-100 transition-colors"
          >
            Start your organisation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Organisations */}
      <section id="organisations" className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6">
          <h3 className="text-xl md:text-2xl font-semibold text-gray-900 text-center mb-8">
            Active organisations
          </h3>
          {organizations.length === 0 ? (
            <p className="text-center text-gray-500 text-sm">
              No organisations yet — be the first to create one.
            </p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/${org.slug}/dashboard`}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition-all flex flex-col gap-2"
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
                      Active
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
              © {new Date().getFullYear()} OrgFlow. All rights reserved.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700">
              Privacy
            </a>
            <a href="#" className="hover:text-gray-700">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
