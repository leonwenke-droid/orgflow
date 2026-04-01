"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  const isDark = (resolvedTheme ?? theme) === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-[var(--radius-input)] p-2 text-[var(--ink-3)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)] dark:text-white/55 dark:hover:bg-white/6 dark:hover:text-white"
      aria-label={t("theme.toggle_aria", locale)}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
