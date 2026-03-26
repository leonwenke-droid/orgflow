import { getRequestLocale } from "../../lib/localeServer";
import TermsContent from "../../components/legal/TermsContent";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const locale = await getRequestLocale();
  return <TermsContent locale={locale} />;
}
