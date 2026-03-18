import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME } from "../../lib/i18n";
import PrivacyContent from "../../components/legal/PrivacyContent";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return <PrivacyContent locale={locale} />;
}
