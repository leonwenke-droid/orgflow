import { getRequestLocale } from "../../lib/localeServer";
import PrivacyContent from "../../components/legal/PrivacyContent";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  return <PrivacyContent locale={locale} />;
}
