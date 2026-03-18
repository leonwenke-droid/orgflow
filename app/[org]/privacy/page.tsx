import { cookies } from "next/headers";
import Link from "next/link";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import PrivacyContent from "../../../components/legal/PrivacyContent";

export const dynamic = "force-dynamic";

export default async function OrgPrivacyPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug =
    typeof (params as Promise<{ org: string }>).then === "function"
      ? (await (params as Promise<{ org: string }>)).org
      : (params as { org: string }).org;
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <div className="space-y-4">
      <p className="px-6 pt-6 text-sm">
        <Link href={`/${orgSlug}/dashboard`} className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400">
          ← {t("dashboard.title", locale)}
        </Link>
      </p>
      <PrivacyContent locale={locale} />
    </div>
  );
}
