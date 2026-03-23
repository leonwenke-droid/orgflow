import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";

/**
 * Onboarding for a new organisation: authorised person sets up –
 * import members, create teams, assign admins.
 */
export default async function OnboardingPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = props.params;
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/onboarding`);

  const canAccess = await isOrgAdmin(org.id);
  if (!canAccess) redirect(`/${orgSlug}/dashboard`);
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("onboarding.setup_title", locale).replace("{name}", org.name)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {t("onboarding.setup_intro", locale)}
      </p>

      <ol className="mt-8 list-inside list-decimal space-y-6 text-sm text-gray-700">
        <li>
          <strong className="text-gray-900">{t("onboarding.step_members_title", locale)}</strong>
          <p className="mt-1 text-gray-600">
            {t("onboarding.step_members_desc", locale)}
          </p>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="mt-2 inline-block text-blue-600 underline hover:text-blue-700"
          >
            → {t("onboarding.step_members_cta", locale)}
          </Link>
        </li>
        <li>
          <strong className="text-gray-900">{t("onboarding.step_teams_title", locale)}</strong>
          <p className="mt-1 text-gray-600">
            {t("onboarding.step_teams_desc", locale)}
          </p>
          <Link
            href={`/${orgSlug}/admin/committees`}
            className="mt-2 inline-block text-blue-600 underline hover:text-blue-700"
          >
            → {t("onboarding.step_teams_cta", locale)}
          </Link>
        </li>
        <li>
          <strong className="text-gray-900">{t("onboarding.step_roles_title", locale)}</strong>
          <p className="mt-1 text-gray-600">
            {t("onboarding.step_roles_desc", locale)}
          </p>
          <Link
            href={`/${orgSlug}/admin/members`}
            className="mt-2 inline-block text-blue-600 underline hover:text-blue-700"
          >
            → {t("onboarding.step_roles_cta", locale)}
          </Link>
        </li>
        <li>
          <strong className="text-gray-900">{t("onboarding.step_manage_title", locale)}</strong>
          <p className="mt-1 text-gray-600">
            {t("onboarding.step_manage_desc", locale)}
          </p>
          <Link
            href={`/${orgSlug}/admin`}
            className="btn-primary mt-2 text-sm"
          >
            {t("onboarding.step_manage_cta", locale)}
          </Link>
        </li>
      </ol>

      <p className="mt-8 text-xs text-gray-500">
        {t("onboarding.setup_footer", locale)}
      </p>
    </div>
  );
}
