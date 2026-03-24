import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  getCurrentOrganization,
  isSuperAdmin,
  resolveMemberProfileForOrganization
} from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
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

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

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
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <Link
          href={`/${orgSlug}/dashboard`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← {t("feedback.back_dashboard", locale)}
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">{t("feedback.page_title", locale)}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("feedback.page_intro", locale)}</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("feedback.form_section", locale)}</h2>
        <FeedbackForm orgSlug={orgSlug} />
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {t("feedback.list_section", locale)}
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {(items ?? []).map((it: { id: string; title: string; description: string | null; status: string; created_at: string }) => (
            <li key={it.id} className="p-4">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{it.title}</p>
              {it.description ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{it.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                {formatLocaleDateTime(it.created_at, locale)} · {it.status}
              </p>
            </li>
          ))}
          {(!items || items.length === 0) && (
            <li className="p-6 text-sm text-gray-600 dark:text-gray-400">{t("feedback.empty_list", locale)}</li>
          )}
        </ul>
      </section>
    </div>
  );
}
