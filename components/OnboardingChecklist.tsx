"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { CheckCircle, Circle } from "lucide-react";

type Props = {
  orgSlug: string;
  teamsCount: number;
  membersCount: number;
  tasksOrShiftsCount: number;
  isAdmin: boolean;
};

export default function OnboardingChecklist({
  orgSlug,
  teamsCount,
  membersCount,
  tasksOrShiftsCount,
  isAdmin
}: Props) {
  const { locale } = useLocale();
  const hasTeam = teamsCount >= 1;
  const hasMembers = membersCount >= 1;
  const hasTaskOrShift = tasksOrShiftsCount >= 1;
  const allDone = hasTeam && hasMembers && hasTaskOrShift;

  if (allDone) return null;

  const steps: { done: boolean; labelKey: string; href?: string }[] = [
    { done: hasTeam, labelKey: "empty.teams", href: isAdmin ? `/${orgSlug}/admin/committees` : undefined },
    { done: hasMembers, labelKey: "empty.members", href: isAdmin ? `/${orgSlug}/admin/members` : undefined },
    { done: hasTaskOrShift, labelKey: "empty.tasks", href: isAdmin ? `/admin/tasks?org=${encodeURIComponent(orgSlug)}` : undefined },
  ];

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <h2 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        {locale === "de" ? "Erste Schritte" : "Getting started"}
      </h2>
      <ul className="space-y-1.5 text-sm">
        {steps.map(({ done, labelKey, href }) => (
          <li key={labelKey} className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            {done ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            )}
            {href ? (
              <Link href={href} className="underline hover:no-underline">
                {t(labelKey, locale)}
              </Link>
            ) : (
              <span>{t(labelKey, locale)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
