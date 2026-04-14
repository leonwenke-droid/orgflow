"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import AuthForm from "../../components/AuthForm";

const CO_SESSION_KEY = "orgflow_create_org_checkout_session";

const ORG_TYPES = [
  { value: "school", label: "School" },
  { value: "club", label: "Club" },
  { value: "sports_club", label: "Sports club" },
  { value: "volunteer_group", label: "Volunteer group" },
  { value: "event_crew", label: "Event crew" },
  { value: "ngo", label: "NGO" },
  { value: "conference", label: "Conference" },
  { value: "custom", label: "Custom" },
];

const MODULES = [
  { key: "tasks", label: "Tasks", description: "Turn open work into clear ownership and done-status." },
  { key: "shifts", label: "Shifts", description: "Fill slots fairly and reduce last-minute scheduling chaos." },
  { key: "finance", label: "Finance", description: "Track treasury updates and keep balances transparent." },
  { key: "resources", label: "Resources", description: "Manage materials and purchases in one place." },
  { key: "engagement", label: "Engagement", description: "Reward contributions and keep workload distribution fair." },
  { key: "events", label: "Events", description: "Coordinate event-specific tasks and shifts (coming soon)." },
];

const PENDING_KEY = "create-org-pending";

export default function CreateOrganisationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const TOTAL_STEPS = 4;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authWall, setAuthWall] = useState(false);
  const [paidTier, setPaidTier] = useState<null | "base" | "scale">(null);
  const [stripeCheckoutSessionId, setStripeCheckoutSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    orgType: "school",
    modules: ["tasks", "shifts", "finance", "resources", "engagement"] as string[],
    teams: [""],
    inviteEmails: "",
  });

  useEffect(() => {
    const tier = searchParams.get("tier");
    const coFlag = searchParams.get("co");
    const sessionId = searchParams.get("checkout_session_id");
    if (tier === "base" || tier === "scale") {
      setPaidTier(tier);
      if (sessionId) {
        setStripeCheckoutSessionId(sessionId);
        try {
          sessionStorage.setItem(CO_SESSION_KEY, sessionId);
        } catch {
          // ignore
        }
        router.replace(`/create-organisation?tier=${tier}&co=1`, { scroll: false });
      } else if (coFlag === "1") {
        try {
          const s = sessionStorage.getItem(CO_SESSION_KEY);
          if (s) setStripeCheckoutSessionId(s);
        } catch {
          // ignore
        }
      } else {
        try {
          sessionStorage.removeItem(CO_SESSION_KEY);
        } catch {
          // ignore
        }
        setStripeCheckoutSessionId(null);
      }
    } else {
      setPaidTier(null);
      setStripeCheckoutSessionId(null);
      try {
        sessionStorage.removeItem(CO_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, [searchParams, router]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step?: number; formData?: typeof formData };
        if (parsed?.formData && typeof parsed.step === "number") {
          setFormData(parsed.formData);
          setStep(Math.min(TOTAL_STEPS, Math.max(1, parsed.step)));
          setAuthWall(false);
        }
        sessionStorage.removeItem(PENDING_KEY);
      } else {
        const legacy = sessionStorage.getItem("create-org-form");
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed?.name) {
            setFormData(parsed);
            setStep(6);
            setAuthWall(false);
          }
          sessionStorage.removeItem("create-org-form");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const normalizeTeams = (teams: string[]) =>
    [...new Set(
      teams
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .map((t) => t.slice(0, 50))
    )];

  const addTeam = () => setFormData((d) => ({ ...d, teams: [...d.teams, ""] }));
  const removeTeam = (i: number) =>
    setFormData((d) => ({
      ...d,
      teams: d.teams.filter((_, j) => j !== i),
    }));
  const updateTeam = (i: number, v: string) =>
    setFormData((d) => ({
      ...d,
      teams: d.teams.map((t, j) => (j === i ? v : t)),
    }));

  const showPaymentFirst = paidTier !== null && !stripeCheckoutSessionId;

  useEffect(() => {
    if (!showPaymentFirst) return;
    if (checkoutLoading || authWall || error) return;
    startPaidCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentFirst]);

  const startPaidCheckout = async () => {
    if (!paidTier) return;
    setCheckoutLoading(true);
    setError(null);
    setAuthWall(false);
    try {
      const res = await fetch("/api/billing/create-checkout-session-new-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: paidTier === "scale" ? "scale" : "base" }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; url?: string };
      if (res.status === 401) {
        setAuthWall(true);
        setCheckoutLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.message || "Checkout could not be started.");
        setCheckoutLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No redirect URL from Stripe.");
    } catch {
      setError("Network error.");
    }
    setCheckoutLoading(false);
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        orgType: formData.orgType,
        modules: formData.modules,
        teams: normalizeTeams(formData.teams),
      };
      if (stripeCheckoutSessionId) {
        payload.stripeCheckoutSessionId = stripeCheckoutSessionId;
      }
      const res = await fetch("/api/create-organisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          try {
            sessionStorage.setItem(
              PENDING_KEY,
              JSON.stringify({ step: 6, formData })
            );
          } catch {
            // ignore quota / private mode
          }
          setAuthWall(true);
          setLoading(false);
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          return;
        }
        setError(data.message || "Failed to create organisation.");
        setLoading(false);
        return;
      }
      const slug = data.slug ?? "";
      try {
        sessionStorage.removeItem(CO_SESSION_KEY);
      } catch {
        // ignore
      }
      if (slug) router.push(`/${slug}/onboarding`);
      else router.push("/");
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  };

  const runQuickstart = () => {
    if (!formData.name.trim()) return;
    setFormData((d) => ({
      ...d,
      modules: ["tasks", "shifts", "finance"]
    }));
    setStep(TOTAL_STEPS);
  };

  const nextDisabledReason =
    step === 1 && !formData.name.trim()
      ? "Enter an organisation name to continue."
      : step === 2 && formData.modules.length === 0
        ? "Select at least one module to continue."
        : null;

  const showCancelledBanner = searchParams.get("cancelled") === "1" && showPaymentFirst;

  return (
    <div className="min-h-screen bg-bg-secondary py-12">
      <div className="mx-auto max-w-xl px-6">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-text-secondary hover:text-text-secondary"
          >
            ← Back to OrgFlow
          </Link>
        </div>

        {showPaymentFirst ? (
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-text-primary">Nächster Schritt</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {paidTier === "scale"
                ? "Tarif ab 50 Mitgliedern (49 €/Monat, ohne Testphase). Sie werden zur Zahlung weitergeleitet; danach richten Sie Ihre Organisation ein."
                : "Pro bis 49 Mitglieder (29 €/Monat, 14 Tage Test vor erster Abbuchung). Sie werden zur Zahlung weitergeleitet; danach richten Sie Ihre Organisation ein."}
            </p>
            {showCancelledBanner ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Checkout was cancelled. Try again below, or start with the free Starter plan.
              </p>
            ) : null}
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            <p className="mt-6 text-sm text-text-secondary">
              {checkoutLoading ? "Weiterleitung…" : "Einen Moment…"}
            </p>
            <p className="mt-4 text-center text-sm text-text-secondary">
              <Link href="/create-organisation" className="font-medium text-blue-600 hover:text-blue-700">
                Start with the free Starter plan instead
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full ${
                    s <= step ? "bg-blue-600" : "bg-bg-tertiary"
                  }`}
                />
              ))}
            </div>
            <p className="mb-6 text-xs font-medium text-text-secondary">
              Step {step} of {TOTAL_STEPS}
            </p>

            <div className="rounded-xl border border-border-subtle bg-bg-primary p-8 shadow-sm">
              {stripeCheckoutSessionId && paidTier ? (
                <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                  Subscription started — now choose a name and modules for your organisation.
                </p>
              ) : null}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-text-primary">
                Organisation name
              </h2>
              <p className="text-sm text-text-secondary">
                Give your organisation a name (e.g. &quot;Class of 2027&quot; or
                &quot;City FC Volunteers&quot;).
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="My Organisation"
                  required
                  className="w-full rounded-lg border border-border-default px-4 py-2.5 text-text-primary focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3">
                <p className="text-xs font-semibold text-text-secondary">Quickstart</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Create your organisation with recommended modules now, configure teams and invites later.
                </p>
                <button
                  type="button"
                  onClick={runQuickstart}
                  disabled={!formData.name.trim()}
                  className="btn-secondary mt-2 text-xs"
                >
                  Use quickstart
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-text-primary">
                Setup basics
              </h2>
              <p className="text-sm text-text-secondary">
                Choose an organisation type and the modules you want to start with. You can change this later in settings.
              </p>
              <div className="space-y-2">
                {ORG_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-subtle p-4 hover:border-blue-200"
                  >
                    <input
                      type="radio"
                      name="orgType"
                      value={t.value}
                      checked={formData.orgType === t.value}
                      onChange={() =>
                        setFormData((d) => ({ ...d, orgType: t.value }))
                      }
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="font-medium text-text-primary">{t.label}</span>
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <div className="text-sm font-medium text-text-primary">Modules</div>
                <p className="mt-1 text-xs text-text-secondary">
                  Start lean. You can enable/disable modules any time.
                </p>
                <div className="mt-3 space-y-3">
                  {MODULES.map((m) => (
                    <label
                      key={m.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle p-4 hover:border-blue-200"
                    >
                      <input
                        type="checkbox"
                        checked={formData.modules.includes(m.key)}
                        onChange={() => {
                          setFormData((d) => ({
                            ...d,
                            modules: d.modules.includes(m.key)
                              ? d.modules.filter((x) => x !== m.key)
                              : [...d.modules, m.key],
                          }));
                        }}
                        className="mt-1 h-4 w-4 rounded border-border-default text-blue-600"
                      />
                      <div>
                        <span className="font-medium text-text-primary">{m.label}</span>
                        <p className="text-xs text-text-secondary">{m.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-text-primary">
                Teams and invites (optional)
              </h2>
              <p className="text-sm text-text-secondary">
                Add a few teams and invite members now — or skip and do it later from the admin area.
              </p>
              <div className="space-y-3">
                {formData.teams.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={t}
                      onChange={(e) => updateTeam(i, e.target.value)}
                      placeholder={`Team ${i + 1}`}
                      className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-text-primary focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeTeam(i)}
                      className="rounded-lg border border-border-default px-3 text-sm text-text-secondary hover:bg-bg-secondary"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTeam}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add team
                </button>
                <p className="text-xs text-text-secondary">
                  Empty rows are ignored. Team names should be at least 2 characters.
                </p>
              </div>

              <div className="border-t border-border-subtle pt-6">
                <div className="text-sm font-medium text-text-primary">Invite members</div>
                <p className="mt-1 text-xs text-text-secondary">
                  Comma- or newline-separated. You can always invite later.
                </p>
                <div className="mt-3">
                  <textarea
                    value={formData.inviteEmails}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, inviteEmails: e.target.value }))
                    }
                    placeholder="one@email.com, two@email.com"
                    rows={4}
                    className="w-full rounded-lg border border-border-default px-4 py-2.5 text-text-primary focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-text-primary">Finish</h2>
              <p className="text-sm text-text-secondary">
                Review and create your organisation.
              </p>
              <div className="rounded-lg bg-bg-secondary p-4 text-sm">
                <p>
                  <strong>Name:</strong> {formData.name || "–"}
                </p>
                <p>
                  <strong>Type:</strong>{" "}
                  {ORG_TYPES.find((t) => t.value === formData.orgType)?.label ??
                    "–"}
                </p>
                <p>
                  <strong>Modules:</strong>{" "}
                  {formData.modules.length > 0
                    ? formData.modules.map((k) => MODULES.find((m) => m.key === k)?.label ?? k).join(", ")
                    : "None"}
                </p>
                <p>
                  <strong>Teams:</strong>{" "}
                  {normalizeTeams(formData.teams).length > 0
                    ? normalizeTeams(formData.teams).join(", ")
                    : "No teams selected (optional)"}
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                After creation you’ll land in onboarding. From there, invite members and start with your first tasks or shifts.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 3) {
                    setFormData((d) => ({ ...d, teams: normalizeTeams(d.teams).length > 0 ? normalizeTeams(d.teams) : [""] }));
                  }
                  setStep((s) => Math.min(TOTAL_STEPS, s + 1));
                }}
                disabled={
                  (step === 1 && !formData.name.trim()) ||
                  (step === 2 && formData.modules.length === 0)
                }
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={nextDisabledReason ?? undefined}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={
                  loading ||
                  !formData.name.trim() ||
                  formData.modules.length === 0 ||
                  (paidTier !== null && !stripeCheckoutSessionId)
                }
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating…" : "Create organisation"}
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
            </div>
          </>
        )}

        {authWall ? (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-[var(--color-warning)]/30 bg-[var(--bg-warning-subtle)] p-6 shadow-sm">
            <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
              Sign in to finish
            </h2>
            <p className="mt-2 text-sm text-[var(--color-warning-text)]">
              Your setup is saved in this browser. Sign in or create an account, then tap{" "}
              <strong>Create organisation</strong> again on the step above.
            </p>
            <div className="mt-4 rounded-lg border border-[var(--color-warning)]/25 bg-bg-primary p-4">
              <AuthForm
                redirectTo={
                  paidTier ? `/create-organisation?tier=${paidTier}` : "/create-organisation"
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
