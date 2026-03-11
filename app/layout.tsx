import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import AppHeader from "../components/AppHeader";
import ToastContainer from "../components/Toast";

export const metadata = {
  title: "OrgFlow",
  description:
    "Organise your team, tasks and events in one place. OrgFlow helps organisations coordinate volunteers, tasks and shifts effortlessly."
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
          <p className="text-xs text-amber-200/80">
            Local: Check your <code className="bg-black/30 px-1 rounded">.env.local</code> and restart the dev server.
            Vercel: Add variables under Project Settings → Environment Variables.
          </p>
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
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          <AppHeader user={user} />
          <main className="flex-1 pb-10">{children}</main>
          <ToastContainer />
          <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
            <a
              href="https://lyniqmedia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400/90 transition-colors"
            >
              powered by LYNIQ Media
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}

