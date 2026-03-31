import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import AppShell from "../components/AppShell";
import ToastContainer from "../components/Toast";
import ThemeProvider from "../components/ThemeProvider";
import { LocaleProvider } from "../components/LocaleProvider";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import CookieNotice from "../components/CookieNotice";
import ConsentSync from "../components/ConsentSync";
import ConditionalRootFooter from "../components/ConditionalRootFooter";
import { LOCALE_COOKIE_NAME, resolveLocale } from "../lib/i18n";
import { getPublicBaseUrl } from "../lib/publicBaseUrl";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OrgFlow",
  description:
    "OrgFlow helps teams and organisations coordinate tasks, shifts and finances in one place — without spreadsheet chaos.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.orgflow.de"),
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "OrgFlow",
    description:
      "Tasks, shifts, and finance — in one place. Organize your team without spreadsheet chaos.",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "OrgFlow" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OrgFlow",
    description: "Tasks, shifts, and finance — in one place.",
    images: ["/og.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OrgFlow"
  }
};

export const viewport = {
  themeColor: "#185FA5"
};

function EnvErrorPage() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-amber-500/50 bg-amber-500/10 p-6 text-amber-200">
          <h1 className="text-lg font-semibold mb-2">Configuration missing</h1>
          <p className="text-sm mb-4">
            Environment variables <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are not set.
          </p>
          <ol className="text-xs text-amber-200/80 space-y-2 list-decimal list-inside">
            <li><strong>Local:</strong> Add them to <code className="bg-black/30 px-1 rounded">.env.local</code> and restart the dev server.</li>
            <li><strong>Vercel:</strong> Project Settings → Environment Variables. Add both variables for Production, Preview, and Development.</li>
            <li><strong>Important:</strong> After adding variables on Vercel, trigger a new deployment (Redeploy). <code>NEXT_PUBLIC_*</code> vars are embedded at build time.</li>
          </ol>
        </div>
      </body>
    </html>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return <EnvErrorPage />;
  }

  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerList.get("accept-language")
  );
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  const appShellUser = user
    ? ({ id: user.id, email: user.email ?? null, user_metadata: (user.user_metadata ?? null) } as const)
    : null;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${dmSans.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground dark:bg-background-dark dark:text-foreground-dark">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('orgflow-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}})();`
          }}
        />
        <ThemeProvider>
          <LocaleProvider initialLocale={locale}>
          <div className="shell-root mx-auto flex min-h-screen max-w-6xl flex-col bg-background px-4 py-6 dark:bg-background-dark">
            <EmailVerificationBanner />
            <AppShell user={appShellUser}>
              <main className="shell-main flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</main>
            </AppShell>
            <ToastContainer />
            <CookieNotice />
            <ConsentSync />
            <ConditionalRootFooter />
        </div>
        </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

