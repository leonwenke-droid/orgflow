"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";

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
  { key: "tasks", label: "Tasks", description: "Assign and track tasks" },
  { key: "shifts", label: "Shifts", description: "Shift planning and scheduling" },
  { key: "finance", label: "Finance", description: "Treasury and budget" },
  { key: "resources", label: "Resources", description: "Materials and procurement" },
  { key: "engagement", label: "Engagement", description: "Points and activity tracking" },
  { key: "events", label: "Events", description: "Event management (coming soon)" },
];

export default function CreateOrganisationClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    orgType: "school",
    modules: ["tasks", "shifts", "finance", "resources", "engagement"] as string[],
    teams: [""],
    inviteEmails: "",
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("create-org-form");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) setFormData(parsed);
        sessionStorage.removeItem("create-org-form");
      }
    } catch {
      // ignore
    }
  }, []);

  const slugFromName = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

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

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/create-organisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          orgType: formData.orgType,
          modules: formData.modules,
          teams: formData.teams.filter((t) => t.trim()),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.setItem("create-org-form", JSON.stringify(formData));
          router.push(`/login?redirectTo=${encodeURIComponent("/create-organisation")}`);
          return;
        }
        setError(data.message || "Failed to create organisation.");
        setLoading(false);
        return;
      }
      const slug = data.slug ?? "";
      if (slug) router.push(`/${slug}/onboarding`);
      else router.push("/");
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-xl px-6">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to OrgFlow
          </Link>
        </div>

        <div className="mb-8 flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Organisation name
              </h2>
              <p className="text-sm text-gray-600">
                Give your organisation a name (e.g. &quot;Class of 2027&quot; or
                &quot;City FC Volunteers&quot;).
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {formData.name && (
                  <p className="mt-1 text-xs text-gray-500">
                    URL: /{slugFromName(formData.name)}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Organisation type
              </h2>
              <p className="text-sm text-gray-600">
                Choose the type that best describes your organisation.
              </p>
              <div className="space-y-2">
                {ORG_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 hover:border-blue-200"
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
                    <span className="font-medium text-gray-900">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Select modules
              </h2>
              <p className="text-sm text-gray-600">
                Choose which features your organisation needs. You can change this later in settings.
              </p>
              <div className="space-y-3">
                {MODULES.map((m) => (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:border-blue-200"
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
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">{m.label}</span>
                      <p className="text-xs text-gray-500">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Create teams
              </h2>
              <p className="text-sm text-gray-600">
                Add teams to organise your members (e.g. Finance, Events,
                Logistics).
              </p>
              <div className="space-y-3">
                {formData.teams.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={t}
                      onChange={(e) => updateTeam(i, e.target.value)}
                      placeholder={`Team ${i + 1}`}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeTeam(i)}
                      className="rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50"
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
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Invite members
              </h2>
              <p className="text-sm text-gray-600">
                You can invite members now or later from the admin area.
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email addresses (optional)
                </label>
                <textarea
                  value={formData.inviteEmails}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, inviteEmails: e.target.value }))
                  }
                  placeholder="one@email.com, two@email.com"
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Comma- or newline-separated. Invites will be sent after
                  creation.
                </p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Finish</h2>
              <p className="text-sm text-gray-600">
                Review and create your organisation.
              </p>
              <div className="rounded-lg bg-gray-50 p-4 text-sm">
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
                  {formData.teams.filter((t) => t.trim()).length > 0
                    ? formData.teams.filter((t) => t.trim()).join(", ")
                    : "None"}
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            {step < 6 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(6, s + 1))}
                disabled={
                  (step === 1 && !formData.name.trim()) ||
                  (step === 3 && formData.modules.length === 0)
                }
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading || !formData.name.trim() || formData.modules.length === 0}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating…" : "Create organisation"}
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
