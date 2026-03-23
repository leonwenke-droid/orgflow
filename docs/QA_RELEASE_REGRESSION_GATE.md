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
