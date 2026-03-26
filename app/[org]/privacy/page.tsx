import { getRequestLocale } from "../../../lib/localeServer";
import Link from "next/link";
import { t } from "../../../lib/i18n";
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
  const locale = await getRequestLocale();

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
