"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";

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
const PENDING_KEY_PERSISTED = "create-org-pending-persisted";

export default function CreateOrganisationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const TOTAL_STEPS = 4;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [planChoice, setPlanChoice] = useState<"starter" | "base" | "scale">("starter");
  const [paidTier, setPaidTier] = useState<null | "base" | "scale">(null);
  const [stripeCheckoutSessionId, setStripeCheckoutSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    orgType: "school",
    modules: ["tasks", "shifts", "finance", "resources", "engagement"] as string[],
  });

  useEffect(() => {
    const tier = searchParams.get("tier");
    const coFlag = searchParams.get("co");
    const sessionId = searchParams.get("checkout_session_id");
    if (tier === "base" || tier === "scale") {
      setPaidTier(tier);
      setPlanChoice(tier);
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
      setPlanChoice("starter");
      try {
        sessionStorage.removeItem(CO_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, [searchParams, router]);

  useEffect(() => {
    try {
      // sessionStorage can be empty after email verification (new tab).
      // Use localStorage as fallback so wizard state survives that.
      const saved =
        sessionStorage.getItem(PENDING_KEY) ??
        (typeof window !== "undefined" ? localStorage.getItem(PENDING_KEY_PERSISTED) : null);
      if (saved) {
        const parsed = JSON.parse(saved) as { step?: number; formData?: typeof formData };
        if (parsed?.formData && typeof parsed.step === "number") {
          setFormData(parsed.formData);
          setStep(Math.min(TOTAL_STEPS, Math.max(1, parsed.step)));
        }
        sessionStorage.removeItem(PENDING_KEY);
        localStorage.removeItem(PENDING_KEY_PERSISTED);
      } else {
        const legacy = sessionStorage.getItem("create-org-form");
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed?.name) {
            setFormData(parsed);
            setStep(TOTAL_STEPS);
          }
          sessionStorage.removeItem("create-org-form");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSignedIn(!!data.session);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const startPaidCheckout = async () => {
    if (!paidTier) return;
    setCheckoutLoading(true);
    setError(null);
      try {
        const res = await fetch("/api/billing/create-checkout-session-new-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: paidTier === "scale" ? "scale" : "base" }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; url?: string };
      if (res.status === 401) {
        setError("Please sign in to continue.");
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
      // Paid tiers: run Stripe checkout AFTER setup, right before creating the org.
      if (paidTier && !stripeCheckoutSessionId) {
        try {
          const payload = JSON.stringify({ step, formData });
          sessionStorage.setItem(PENDING_KEY, payload);
          localStorage.setItem(PENDING_KEY_PERSISTED, payload);
        } catch {
          // ignore quota / private mode
        }
        setLoading(false);
        await startPaidCheckout();
        return;
      }

      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        orgType: formData.orgType,
        modules: formData.modules,
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
            const payload = JSON.stringify({ step, formData });
            sessionStorage.setItem(PENDING_KEY, payload);
            localStorage.setItem(PENDING_KEY_PERSISTED, payload);
          } catch {
            // ignore quota / private mode
          }
          setLoading(false);
          setError("Please sign in to continue.");
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

  const showCancelledBanner = searchParams.get("cancelled") === "1";

  return (
    <div className="min-h-screen bg-bg-secondary py-12 pb-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-text-secondary hover:text-text-secondary"
          >
            ← Back to OrgFlow
          </Link>
        </div>

        {false ? (
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-text-primary">Nächster Schritt</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {paidTier === "scale"
                ? "Tarif ab 50 Mitgliedern (49 €/Monat, 14 Tage Test vor erster Abbuchung). Sie werden zur Zahlung weitergeleitet; danach richten Sie Ihre Organisation ein."
                : "Team bis 49 Mitglieder (29 €/Monat, 14 Tage Test vor erster Abbuchung). Sie werden zur Zahlung weitergeleitet; danach richten Sie Ihre Organisation ein."}
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
              <h2 className="text-xl font-semibold text-text-primary">Finish</h2>
              <p className="text-sm text-text-secondary">
                Review your organisation setup. Next, you’ll choose the subscription (if any) and create the organisation.
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
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                After creation you’ll land in onboarding. From there, invite members and start with your first tasks or shifts.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Tarif auswählen</h2>
                <p className="text-sm text-text-secondary">
                  Starter ist kostenlos. Team und Pro kannst du <span className="font-medium text-text-primary">14 Tage kostenlos testen</span> — erst danach startet die Abbuchung.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex min-h-[420px] flex-col rounded-2xl border border-border-subtle bg-bg-secondary p-8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-text-primary">Starter</div>
                      <div className="mt-1 text-sm text-text-secondary">0 € · für immer kostenlos</div>
                      <div className="mt-3 text-sm text-text-secondary">
                        Für kleine Gruppen und erste Schritte.
                      </div>
                    </div>
                    <span className="tag tag-neutral">Einfach starten</span>
                  </div>
                  <div className="mt-6 h-px w-full bg-border-subtle" />
                  <ul className="mt-6 space-y-3 text-sm text-text-secondary">
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>5 Personen in einem Team</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>Aufgaben &amp; Schichten</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>1 Organisation</li>
                  </ul>
                  <button
                    type="button"
                    className={`btn-secondary mt-auto w-full ${planChoice === "starter" ? "ring-2 ring-blue-500" : ""}`}
                    onClick={() => {
                      setPaidTier(null);
                      setStripeCheckoutSessionId(null);
                      setPlanChoice("starter");
                    }}
                  >
                    Kostenlos starten
                  </button>
                </div>

                <div className="flex min-h-[420px] flex-col rounded-2xl border border-blue-600/30 bg-bg-primary p-8 shadow-sm ring-1 ring-blue-600/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-text-primary">Team</div>
                      <div className="mt-1 text-sm text-text-secondary">29 €</div>
                      <div className="mt-1 text-sm text-text-secondary">pro Monat · bis 49 Mitglieder</div>
                      <div className="mt-3 text-sm text-text-secondary">
                        Für aktive Organisationen — bis 49 Mitglieder. Größer? Siehe Tarif rechts (49 €).
                      </div>
                    </div>
                    <span className="tag tag-blue">Empfohlen</span>
                  </div>
                  <div className="mt-6 h-px w-full bg-border-subtle" />
                  <ul className="mt-6 space-y-3 text-sm text-text-secondary">
                    <li className="flex gap-2"><span className="mt-[2px] text-brand">✓</span>2‑wöchige kostenlose Testphase vor erster Abbuchung</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-brand">✓</span>Bis zu 49 Mitglieder inklusive</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-brand">✓</span>Alle Features</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-brand">✓</span>Finanzen &amp; CSV‑Export</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-brand">✓</span>Engagement Score</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-brand">✓</span>Prioritäts‑Support</li>
                  </ul>
                  <button
                    type="button"
                    className={`btn-primary mt-auto w-full ${planChoice === "base" ? "ring-2 ring-blue-500" : ""}`}
                    onClick={() => {
                      setPaidTier("base");
                      setPlanChoice("base");
                    }}
                  >
                    14 Tage kostenlos testen
                  </button>
                </div>

                <div className="flex min-h-[420px] flex-col rounded-2xl border border-border-subtle bg-bg-secondary p-8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-text-primary">Pro</div>
                      <div className="mt-1 text-sm text-text-secondary">49 €</div>
                      <div className="mt-1 text-sm text-text-secondary">pro Monat · ab dem 50. Mitglied</div>
                      <div className="mt-3 text-sm text-text-secondary">
                        Derselbe Funktionsumfang wie Team — fester Preis für große Teams.
                      </div>
                    </div>
                    <span className="tag tag-neutral">Für große Teams</span>
                  </div>
                  <div className="mt-6 h-px w-full bg-border-subtle" />
                  <ul className="mt-6 space-y-3 text-sm text-text-secondary">
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>2‑wöchige kostenlose Testphase vor erster Abbuchung</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>Unbegrenzt viele Mitglieder</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>Alle Team‑Features (Finanzen, Engagement, …)</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>Buchung &amp; Upgrade direkt in der Organisation</li>
                    <li className="flex gap-2"><span className="mt-[2px] text-text-muted">✓</span>Prioritäts‑Support</li>
                  </ul>
                  <button
                    type="button"
                    className={`btn-secondary mt-auto w-full ${planChoice === "scale" ? "ring-2 ring-blue-500" : ""}`}
                    onClick={() => {
                      setPaidTier("scale");
                      setPlanChoice("scale");
                    }}
                  >
                    14 Tage kostenlos testen
                  </button>
                </div>
              </div>
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
      </div>
    </div>
  );
}
