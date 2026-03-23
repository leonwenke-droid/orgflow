# QA Release Regression Gate

Diese Checkliste blockiert Releases, bis alle Blocker reproduzierbar gruen sind.

## 1) Task-Workflow

- Member kann `Claim` auf offene Aufgabe ausfuehren.
- Zugewiesener Member kann im Modal `In Progress` setzen.
- Zugewiesener Member kann `Done` setzen.
- Admin kann Aufgabenstatus ebenfalls aktualisieren.
- `proof_required=false`: Abschluss ohne Upload moeglich.
- `proof_required=true`: Abschluss ohne Upload geblockt, mit Upload erfolgreich.

## 2) Shift-Daten

- `required_slots` bleibt nach Erstellung unveraendert sichtbar.
- Zeiten bleiben stabil (`HH:MM`) ohne Spruenge.
- Keine Anzeige wie `1:00:00` in Nutzeroberflaechen.

## 3) Shift-Swap / Claim Feedback

- Nach `Offer swap` erscheint Erfolg oder klare Fehlermeldung.
- Nach `Take over` erscheint Erfolg oder klare Fehlermeldung.
- Nach Task-Claim/Freigabe erscheint Erfolg oder klare Fehlermeldung.

## 4) Admin-Sichtbarkeit

- Admin-Dashboard zeigt offene Aufgaben inkl. zugewiesener Tasks.
- Dashboard/Schichtansicht zeigt Namen eingeteilter Personen.

## 5) Build- und Qualitaetsgates

```bash
npm run build
npm run lint
npx tsc --noEmit
```

Release-Freigabe nur bei:

- allen Blocker-Punkten `passed`
- gruenem Build/Lint/Typecheck

## Phase-A Abnahme (Sprint 1)

Stand: 2026-03-18

- A1 Teams anlegen (`stack depth`): `passed` (Admin-Create nutzt Service-Role-Write; DB-Fehler wird nutzerfreundlich gemappt).
- A2 Mitgliederanlage (`stack depth`): `passed` (Add/Update/Delete/Invite-Pfade nutzen Service-Role-Write; rekursive RLS-Pfade umgangen).
- A3 Aufgabenstatus Admin+Member: `passed` (Membership-Abfrage in API via Service-Role stabilisiert; `proof_required` wird nur beim Status `erledigt` erzwungen).
- A4 Debug-/Seed-Meldungen im UI: `passed` (technische Seed-Meldung durch produktgeeigneten Nutzerhinweis ersetzt).
- A5 Route-/Layout-Auth Flash: `passed` (Admin-Sidebar wird auf Admin-Routen erst nach positivem Role-Check gerendert; Middleware-Matcher fuer Settings/Onboarding gehaertet).
- A6 Session-/Org-Wechsel: `passed` (Login flow leert alte Session vor neuem Sign-In, reduziert Access-denied-Race bei Account-Wechsel).

### Build/Quality Nachweis

- `npm run lint`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
