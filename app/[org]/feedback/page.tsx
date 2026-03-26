import Link from "next/link";
import { getRequestLocale } from "../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  getCurrentOrganization,
  isSuperAdmin,
  resolveMemberProfileForOrganization
} from "../../../lib/getOrganization";
import { t } from "../../../lib/i18n";
import { formatLocaleDateTime } from "../../../lib/formatDate";
import FeedbackForm from "./FeedbackForm";

export const dynamic = "force-dynamic";

export default async function OrgFeedbackPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;
  const org = await getCurrentOrganization(orgSlug);

  const locale = await getRequestLocale();

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("feedback.sign_in_hint", locale)}{" "}
          <Link href={`/${orgSlug}/login`} className="text-blue-600 underline dark:text-blue-400">
            {t("feedback.sign_in_link", locale)}
          </Link>
        </p>
      </div>
    );
  }

  const superUser = await isSuperAdmin();
  const prof = superUser
    ? null
    : await resolveMemberProfileForOrganization(user.id, orgSlug, org);

  if (!superUser && !prof?.id) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{t("feedback.error_not_member", locale)}</p>
      </div>
    );
  }

  const orgIdsForFeedback = [...new Set([org.id, prof?.organization_id].filter(Boolean))] as string[];
  const frBase = supabase
    .from("feature_requests")
    .select("id, title, description, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: items } =
    orgIdsForFeedback.length <= 1
      ? await frBase.eq("organization_id", orgIdsForFeedback[0] ?? org.id)
      : await frBase.in("organization_id", orgIdsForFeedback);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{t("feedback.page_title", locale)}</h1>
          <p className="page-sub">{org.name}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="btn-secondary">
          ← {t("feedback.back_dashboard", locale)}
        </Link>
      </header>

      <section className="card">
        <div className="p-4 space-y-4">
          <div>
            <div className="section-label">{t("feedback.form_section", locale)}</div>
            <p className="mt-1 text-sm text-gray-600">{t("feedback.page_intro", locale)}</p>
          </div>
          <FeedbackForm orgSlug={orgSlug} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="section-label">{t("feedback.list_section", locale)}</div>
        </div>
        <ul className="divide-y divide-gray-100">
          {(items ?? []).map((it: { id: string; title: string; description: string | null; status: string; created_at: string }) => (
            <li key={it.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{it.title}</p>
                  {it.description ? (
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{it.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-gray-500">{formatLocaleDateTime(it.created_at, locale)}</p>
                </div>
                <span className="tag tag-neutral">{String(it.status ?? "").toUpperCase() || "—"}</span>
              </div>
            </li>
          ))}
          {(!items || items.length === 0) ? (
            <li className="p-4 text-sm text-gray-600">{t("feedback.empty_list", locale)}</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
