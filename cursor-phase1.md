# OrgFlow — Phase 1 Completion Prompt

Du arbeitest im OrgFlow Repository (Next.js 14, App Router, Supabase, Tailwind CSS).
Die App ist funktional fertig. Jetzt geht es um Design-Konsistenz, Navigation und Grundlagen.

Lies vor jeder Änderung die betroffene Datei vollständig. Ändere nie Supabase-Queries.
Führe nach jeder Aufgabe `npm run build` aus und behebe TypeScript-Fehler sofort.

---

## AUFGABE 1 — Navigation bereinigen

### Problem
Es gibt zwei verschiedene Navigationen die sich widersprechen:
- Sidebar zeigt: Dashboard, Tasks, Shifts, Members, Resources, Finance
- Admin zeigt: Members, Teams, Tasks, Shifts, Resources, Treasury, Assign points

Das verwirrt Nutzer. Es braucht eine einzige konsistente Struktur.

### Lösung
Ersetze die bestehende Navigation in `components/HeaderNav.tsx` und `components/Sidebar.tsx`
(falls vorhanden) mit dieser einheitlichen Struktur:

```
CORE
  Dashboard          → /[org]/dashboard
  Tasks              → /[org]/admin/tasks
  Shifts             → /[org]/admin/shifts
  Members            → /[org]/admin/members
  Teams              → /[org]/admin/committees

ORGANISATION
  Resources          → /[org]/admin/materials
  Finance            → /[org]/admin/treasury
  Engagement         → /[org]/admin/scores/assign

ADMINISTRATION
  Settings           → /[org]/settings
  Admin Overview     → /[org]/admin
```

Implementierung in `components/Sidebar.tsx` (neu erstellen falls nicht vorhanden):

```tsx
"use client";

import { usePathname } from "next/navigation";
import FullPageLink from "./FullPageLink";
import LogoutButton from "./LogoutButton";
import {
  LayoutDashboard, CheckSquare, CalendarDays,
  Users, UsersRound, Package, Wallet,
  Trophy, Settings2, ShieldCheck
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const RESERVED = ["admin","dashboard","login","super-admin","task","api","claim-org","auth","create-organisation","join"];

type NavItem = { href: string; label: string; icon: React.ElementType };

const getNavSections = (org: string) => [
  {
    title: "Core",
    items: [
      { href: `/${org}/dashboard`,            label: "Dashboard",  icon: LayoutDashboard },
      { href: `/${org}/admin/tasks`,           label: "Tasks",      icon: CheckSquare     },
      { href: `/${org}/admin/shifts`,          label: "Shifts",     icon: CalendarDays    },
      { href: `/${org}/admin/members`,         label: "Members",    icon: Users           },
      { href: `/${org}/admin/committees`,      label: "Teams",      icon: UsersRound      },
    ],
  },
  {
    title: "Organisation",
    items: [
      { href: `/${org}/admin/materials`,       label: "Resources",  icon: Package         },
      { href: `/${org}/admin/treasury`,        label: "Finance",    icon: Wallet          },
      { href: `/${org}/admin/scores/assign`,   label: "Engagement", icon: Trophy          },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: `/${org}/settings`,              label: "Settings",   icon: Settings2       },
      { href: `/${org}/admin`,                 label: "Admin",      icon: ShieldCheck     },
    ],
  },
];

export default function Sidebar({
  user,
  orgName,
}: {
  user: User | null;
  orgName: string | null;
}) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const orgSlug =
    segments.length >= 1 && !RESERVED.includes(segments[0])
      ? segments[0]
      : null;

  if (!orgSlug || !user) return null;

  const isActive = (href: string) =>
    pathname === href ||
    (href !== `/${orgSlug}/dashboard` && pathname.startsWith(href));

  const sections = getNavSections(orgSlug);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center px-5 border-b border-slate-800">
        <span className="text-white font-bold text-lg tracking-tight">OrgFlow</span>
      </div>

      {/* Org name */}
      {orgName && (
        <div className="px-5 py-2.5 border-b border-slate-800">
          <p className="text-xs font-medium text-slate-400 truncate">{orgName}</p>
        </div>
      )}

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => (
                <FullPageLink
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(href)
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </FullPageLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="shrink-0 px-3 py-3 border-t border-slate-800">
        <LogoutButton returnTo={`/${orgSlug}/dashboard`} />
      </div>
    </aside>
  );
}
```

Dann in `app/layout.tsx`:
1. Sidebar importieren und rendern
2. Content-Bereich mit `lg:pl-60` versehen damit er nicht unter der Sidebar liegt
3. AppHeader auf nur noch Org-Name + User-Avatar reduzieren (keine Nav-Links mehr)

---

## AUFGABE 2 — Dark Mode einführen

### Schritt 1: next-themes installieren
```bash
npm install next-themes
```

### Schritt 2: ThemeProvider in Root Layout
Öffne `app/layout.tsx` und wrappe alles in den ThemeProvider:

```tsx
import { ThemeProvider } from "next-themes";

// Im JSX:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {/* restlicher Inhalt */}
</ThemeProvider>
```

### Schritt 3: Dark Colors in tailwind.config.ts
Öffne `tailwind.config.ts` und ergänze die Theme-Farben:

```ts
extend: {
  colors: {
    // Bestehende Farben behalten, ergänzen:
    background: {
      DEFAULT: "#ffffff",
      dark: "#0f172a",
    },
    card: {
      DEFAULT: "#f9fafb",
      dark: "#1e293b",
    },
    "card-border": {
      DEFAULT: "#e5e7eb",
      dark: "#334155",
    },
    foreground: {
      DEFAULT: "#1f2937",
      dark: "#e2e8f0",
    },
    muted: {
      DEFAULT: "#6b7280",
      dark: "#94a3b8",
    },
  },
},
```

### Schritt 4: Dark Mode Toggle Komponente
Erstelle `components/ThemeToggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
```

Füge `<ThemeToggle />` in den AppHeader ein (rechte Seite, neben Logout).

### Schritt 5: Bestehende Komponenten mit dark: Klassen erweitern
Suche alle Dateien die `bg-white` oder `bg-gray-50` verwenden:
```bash
grep -rn "bg-white\|bg-gray-50\|bg-gray-100" --include="*.tsx" components/ app/
```

Ersetze schrittweise:
- `bg-white` → `bg-white dark:bg-card-dark`
- `bg-gray-50` → `bg-gray-50 dark:bg-background-dark`
- `text-gray-900` → `text-gray-900 dark:text-foreground-dark`
- `border-gray-200` → `border-gray-200 dark:border-card-border-dark`
- `text-gray-500` → `text-gray-500 dark:text-muted-dark`

Priorisierung: Dashboard → Admin Page → alle anderen.

---

## AUFGABE 3 — Admin Dashboard Cards neu gestalten

### Problem
Die Modul-Cards im Admin Dashboard wirken wie random farbige Buttons.

### Lösung
Öffne `app/[org]/admin/page.tsx` und ersetze die Card-Komponenten.

Jede Card soll genau drei Elemente haben:
1. Icon (einfarbig, `text-blue-600`)
2. Titel (fett, `text-slate-900`)
3. Beschreibung (kurz, `text-slate-500`)

```tsx
const modules = [
  {
    href: `/${orgSlug}/admin/members`,
    icon: Users,
    title: "Members",
    description: "Invite and manage organisation members",
  },
  {
    href: `/${orgSlug}/admin/committees`,
    icon: UsersRound,
    title: "Teams",
    description: "Create teams and assign team leads",
  },
  {
    href: `/${orgSlug}/admin/tasks`,
    icon: CheckSquare,
    title: "Tasks",
    description: "Manage tasks across teams",
  },
  {
    href: `/${orgSlug}/admin/shifts`,
    icon: CalendarDays,
    title: "Shifts",
    description: "Plan shifts and auto-assign members",
  },
  {
    href: `/${orgSlug}/admin/materials`,
    icon: Package,
    title: "Resources",
    description: "Track materials and procurement",
  },
  {
    href: `/${orgSlug}/admin/treasury`,
    icon: Wallet,
    title: "Finance",
    description: "Manage treasury and transactions",
  },
  {
    href: `/${orgSlug}/admin/scores/assign`,
    icon: Trophy,
    title: "Engagement",
    description: "Assign points and view leaderboard",
  },
];

// Card Rendering:
{modules.map(({ href, icon: Icon, title, description }) => (
  <Link
    key={href}
    href={href}
    className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-card-dark dark:hover:border-blue-700"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-800">
      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    </div>
    <div>
      <p className="font-semibold text-slate-900 dark:text-foreground-dark">{title}</p>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-muted-dark">{description}</p>
    </div>
  </Link>
))}
```

Grid Layout für die Cards:
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

---

## AUFGABE 4 — Dashboard Widgets verbessern

### Problem
Das Dashboard zeigt Members, Teams, Avg Score — aber Admins wollen wissen was sie tun müssen.

### Lösung
Öffne `app/[org]/dashboard/page.tsx`. Die bestehenden Supabase-Queries NICHT ändern.
Nur die Darstellung der Daten verbessern.

Neue Widget-Reihenfolge (oben):
```tsx
// Zeile 1: Aktions-relevante Stats
<StatCard icon={CheckSquare}   label="Open Tasks"       value={stats.total_open}       sub="tasks need attention"  />
<StatCard icon={CalendarDays}  label="Upcoming Shifts"  value={upcomingShifts}         sub="in the next 7 days"    />
<StatCard icon={Wallet}        label="Treasury"         value={`€${balance}`}          sub="current balance"       />
<StatCard icon={Users}         label="Active Members"   value={activeMembers}          sub="last 30 days"          />
```

StatCard Komponente (inline in der Datei oder in `components/StatCard.tsx`):
```tsx
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-card-dark">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500 dark:text-muted-dark">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-800">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-foreground-dark">{value}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-muted-dark">{sub}</p>
    </div>
  );
}
```

Grid:
```tsx
<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
```

---

## AUFGABE 5 — Sprache vereinheitlichen

Alle deutschen Strings in der UI müssen auf Englisch. Supabase-Queries und Datenbankfelder nicht anfassen.

```bash
# Alle Dateien mit deutschen Strings finden:
grep -rn "Schichten\|Aufgaben\|Kassenstand\|Hochladen\|Anmelden\|Komitee\|auswählen\|anlegen\|Datum\|Offen\|Erledigt\|Überfällig\|erforderlich\|Pausenverkauf" \
  --include="*.tsx" --include="*.ts" \
  app/ components/ | grep -v "node_modules"
```

Für jede gefundene Datei einzeln öffnen und ersetzen:

| Deutsch | Englisch |
|---|---|
| Schichten | Shifts |
| Aufgaben | Tasks |
| Kassenstand | Treasury balance |
| Hochladen | Upload |
| Anmelden | Sign in |
| Komitee auswählen | Select team |
| Neue Aufgabe anlegen | New task |
| Datum wählen | Select date |
| Offen | Open |
| In Arbeit | In progress |
| Erledigt | Done |
| Überfällig | Overdue |
| erforderlich | required |
| Pausenverkauf | Shift type |
| Name (erforderlich) | Name (required) |
| Hochladen | Upload |

**Wichtig:** i18n Framework (next-intl etc.) noch NICHT einführen — das ist Phase 2.
Jetzt erstmal alle Strings direkt auf Englisch setzen.

---

## AUFGABE 6 — Cyan-Farben entfernen

Cyan soll komplett raus. Blau ist die Primärfarbe.

```bash
# Alle Cyan-Klassen finden:
grep -rn "cyan" --include="*.tsx" --include="*.ts" --include="*.css" app/ components/ tailwind.config.ts
```

Ersetze:
- `text-cyan-*` → `text-blue-*` (gleiche Zahl)
- `bg-cyan-*` → `bg-blue-*`
- `border-cyan-*` → `border-blue-*`
- `ring-cyan-*` → `ring-blue-*`
- `hover:bg-cyan-*` → `hover:bg-blue-*`

In `tailwind.config.ts`: Alle `cyan` Einträge aus der custom Palette entfernen.

---

## Reihenfolge

```
1.  Aufgabe 1  → Sidebar erstellen + Layout anpassen
2.  npm run build
3.  Aufgabe 5  → Deutsche Strings → Englisch (schnell, sicher)
4.  Aufgabe 6  → Cyan → Blau
5.  npm run build
6.  Aufgabe 2  → Dark Mode (next-themes + Toggle + dark: Klassen)
7.  npm run build
8.  Aufgabe 3  → Admin Cards neu gestalten
9.  Aufgabe 4  → Dashboard Widgets
10. npm run build → Finaler Check
```

---

## Nicht in Phase 1 (kommt später)

- Events System (komplexes Feature, Phase 2)
- Notifications (Phase 2)
- i18n Framework / Sprachumschalter (Phase 2)
- Calendar View (Phase 2)
- Member Profiles (Phase 2)
- Activity Feed (Phase 2)
- Super Admin UI (Phase 3)

---

## Kritische Regeln

- Keine Supabase-Queries anfassen
- `FullPageLink` statt `<Link>` für interne Navigation (schon so im Projekt)
- Keine neuen npm-Packages außer `next-themes`
- Nach jeder Aufgabe bauen und TypeScript-Fehler sofort beheben
- Zuerst lesen, dann ändern