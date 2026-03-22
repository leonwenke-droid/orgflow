# Prüfliste: Admin- vs. Mitglieder-Ansicht (Aufgaben & Schichten)

Stand: Code-Review im Repo. Manuell in **zwei Browsern/Profilen** testen.

## Erwartetes Verhalten

| Bereich | Mitglieder-Link (Core) | Verwaltung (Organisation, nur Admin/Lead) |
|--------|-------------------------|-------------------------------------------|
| Aufgaben | `/{org}/tasks` | `/{org}/admin/tasks` → `/admin/tasks?org=…` |
| Schichten | `/{org}/shifts` | `/{org}/admin/shifts` → `/admin/shifts?org=…` |

- Sidebar **Core**: „Aufgaben“ / „Schichten“ zeigen **immer** die Mitglieder-Routen (auch für Admin/Lead).
- Sidebar **Organisation**: zusätzliche Einträge **„Aufgaben verwalten (Org)“** / **„Schichtplanung (Org)“** (`nav.admin_*` in `lib/i18n.ts`).
- Dashboard-Kacheln „Offene Aufgaben“ / „Kommende Schichten“: **persönliche** Zahlen für alle Rollen.
- Leerer Schichtplan auf dem Dashboard: Admin sieht **Schicht anlegen** + **Schichten (meine Ansicht)**; Mitglied nur die Mitglieder-Seite.

## Technische Checks (lokal)

```bash
npm run build
npm run lint
npx tsc --noEmit
```

ESLint: Projekt nutzt `.eslintrc.json` mit `next/core-web-vitals` (kein interaktives Setup nötig).

## QR Check-in (Admin-Schichtplan)

- Kein sichtbares QR-Bild; **Download PNG** (`DownloadQrPngButton`).
- Siehe `docs/QR_CHECKIN.md`.

## Bekannte bewusste Ausnahmen

- **Admin-Übersicht** (`/{org}/admin`): Kacheln verlinken weiterhin direkt auf Admin-Tasks / Admin-Schichten (sinnvoll).
- **Events-Admin**: Links zu `/admin/tasks?org=…` / `/admin/shifts?org=…` mit Event-Filter (Verwaltung).
- **Onboarding-Checkliste**: Schritt „Aufgaben/Schichten anlegen“ verweist Admins auf **Admin-Tasks** (Ersteinrichtung).
- **`app/admin/shifts` EmptyState**: Button „Schicht anlegen“ zeigt ggf. erneut dieselbe URL (Seite ist leer bis erste Schicht im Formular oben angelegt wird).

## Dashboard `getData`

- Kein ungenutztes Task-Aggregat mehr; Task-Anzahl für Onboarding kommt aus einem **Count-Query** (`head: true`), nicht aus dem Laden aller Task-Zeilen.

## API `GET /api/org-settings`

- `canManageOrg` nutzt `canManageOrg(role)` aus `lib/permissions.ts` (`admin`, `owner`, `lead`, `super_admin`).
- Sidebar blendet Organisation-Module erst ein, wenn `canManageOrg === true` geladen ist (kein Flackern bei `null`).
