import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE_NAME } from "../../lib/i18n";
import TermsContent from "../../components/legal/TermsContent";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return <TermsContent locale={locale} />;
}
