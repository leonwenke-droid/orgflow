import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveLocale, type Locale } from "./i18n";

/** Server-only: cookie wins, else Accept-Language (see `resolveLocale`). */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const headerList = await headers();
  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerList.get("accept-language")
  );
}
