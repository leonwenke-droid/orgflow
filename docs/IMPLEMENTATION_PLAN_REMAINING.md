# Implementierungsplan: Verbleibende OrgFlow-Punkte (Stand 17.03.2026)

Kurzplan für die Punkte aus der Analyse (öffentliche Ansicht, Self-Signup, i18n-Fertigstellung, Datenschutz, User-Dashboard, Self-Service). Reihenfolge nach Impact und Abhängigkeiten.

---

## 1. Öffentliche / Read-Only-Ansicht absichern

**Ziel:** Dashboard nicht oder nur stark eingeschränkt für Unbefugte; Rollen pro Modul.

| # | Task | Details |
|---|------|--------|
| 1.1 | Dashboard nur nach Login ODER Public-View reduzieren | **Option A:** `/[org]/dashboard` nur für eingeloggte Nutzer (Redirect zu Login). **Option B:** Öffentliche Route behalten, aber sensible Daten ausblenden (Treasury-Betrag, Mitgliederzahl, offene Tasks-Zahl); nur „Willkommen bei {org.name}“ + Login/Registrieren-CTA. |
| 1.2 | Rollenrechte pro Modul prüfen | Sicherstellen: Treasury, Einnahmen/Ausgaben, Mitgliederliste nur für Admin/Lead (bzw. konfigurierbare Rolle). RLS + Server-Checks in allen relevanten Routen/Server Actions. |
| 1.3 | Kennzahlen-Karten im Dashboard konditionell | Wenn Public-View: Karten „Treasury“, „Members“, „Open Tasks“ nur rendern, wenn `user` und Berechtigung vorhanden; sonst Platzhalter oder weglassen. |

**Dateien:** `app/[org]/dashboard/page.tsx`, `app/[org]/layout.tsx` (optional Redirect), RLS-Policies in Migrations, ggf. `lib/getOrganization.ts` (Hilfe für „darf Treasury sehen?“).

---

## 2. Self-Signup und Invite-Flows (mit E-Mail-Verifizierung)

**Ziel:** Externe können sich registrieren/beitreten; Einladungslinks; E-Mail-Bestätigung; Passwort-Reset.

| # | Task | Details |
|---|------|--------|
| 2.1 | Registrierung ohne Invite (optional) | Route z. B. `/signup` oder „Registrieren“ auf Login-Seite; Supabase `signUp` mit `emailRedirectTo` für Bestätigung. |
| 2.2 | Invite-Link-Flow konsolidieren | Bestehende Invite-Links (`invite_links`, Join-Route) durchgängig nutzen: Einladung öffnen → Registrierung/Login → Zuordnung zu Org + ggf. Rolle. Nach E-Mail-Bestätigung Redirect in Org-Dashboard. |
| 2.3 | E-Mail-Verifizierung erzwingen | Supabase: „Confirm email“ aktivieren. In App: Wenn `user && !user.email_confirmed_at`, Banner anzeigen („Bitte E-Mail bestätigen“) und ggf. Admin-Funktionen deaktivieren, bis bestätigt. |
| 2.4 | Passwort-Reset | Supabase `resetPasswordForEmail`; Seite `/forgot-password` (existiert ggf. schon) mit Formular und Hinweis „Link zum Zurücksetzen wurde gesendet“. |
| 2.5 | Login-Headline konfigurierbar/neutral | Text „Sign in – Abitur 2026 – Teletta-Groß-Gymnasium“ aus Org-Daten oder i18n ableiten (z. B. „Sign in – {orgName}“), keine hart codierte Abitur-Referenz. |

**Dateien:** `app/auth/forgot-password`, `app/join/[org]`, `app/[org]/login`, Invite-Generierung in Admin-Members, Supabase Auth-Einstellungen (Dashboard).

---

## 3. Abitur-Spezifika entfernen & i18n fertigstellen

**Ziel:** Keine Schul-spezifischen Platzhalter/Beispiele; alle sichtbaren Texte über i18n; generische Begriffe.

| # | Task | Details |
|---|------|--------|
| 3.1 | Verbleibende DE-Strings in i18n | Codebase nach hart codierten deutschen Wörtern durchsuchen („Ersatz“, „Anwesenheit“, „Abbr.“, „OK“, „Begründung“, „Uhrzeit“ in Komponenten, die noch nicht `t()` nutzen). Keys in `lib/i18n.ts` anlegen (EN/DE), Komponenten umstellen. |
| 3.2 | Schicht-/Treasury-Platzhalter neutral | Alle Platzhalter wie „Morning shift, Bar duty“, „Canteen, Hall“, „Halloween Party“ durch generische i18n-Keys ersetzen (z. B. „e.g. Shift title“, „e.g. Location“, „e.g. Event name“). |
| 3.3 | Datums-/Zeit-Widgets sprachabhängig | Sicherstellen, dass Kalender, Date-Picker, Monatsnamen und Wochentage `locale` aus `useLocale()` bzw. Cookie nutzen (bereits `lib/date.ts`; alle Nutzer dieser Komponenten prüfen). |
| 3.4 | Navigation & Buttons vollständig übersetzen | Sidebar, Breadcrumbs, Buttons („Abbr.“ → `common.cancel`, „Export“ etc.) einheitlich über i18n; keine Mischung EN/DE in derselben Ansicht. |
| 3.5 | Beispieldaten/Texte in DB/Seeds | Teams wie „Abiball“, „Mottowoche“ nur in Dev-Seeds belassen oder durch neutrale Beispiele ersetzen; Hinweis in Doku, dass Produktion keine Abi-Beispiele enthalten sollte. |

**Dateien:** `lib/i18n.ts`, `components/*.tsx` (ShiftEditModal, ShiftPlanWeekNav, Treasury, Export, Sidebar), `app/[org]/layout.tsx` (Sidebar).

---

## 4. Schicht-Modul: Self-Sign-Up, Auto-Assignment, Ersatz, Übersetzung

**Ziel:** Self-Sign-Up sichtbar/nutzbar; Auto-Zuteilung dokumentiert/konfigurierbar; Ersatz-System klar; 100 % übersetzt.

| # | Task | Details |
|---|------|--------|
| 4.1 | Self-Sign-Up im Dashboard prüfen | Sicherstellen, dass „Sign up“ im Schichtplan für alle Org-Mitglieder sichtbar ist (nicht nur Admin); API `/api/shifts/claim` und Fehlermeldungen (z. B. „No free slots“) in i18n. |
| 4.2 | Auto-Assignment sichtbar machen | Im Admin-Shifts-UI Hinweis oder Button „Auto-Zuteilung ausführen“ für Schichten mit `auto_assign = true`; Kurzbeschreibung des Algorithmus (Engagement, Rotation) in Doku oder Tooltip. |
| 4.3 | Ersatz-/No-Show-UI vollständig übersetzen | Alle Labels in ShiftEditModal und zugehörigen Modals („Ersatz“, „No-show“, „Replacement found“, „Anwesenheit als PDF exportieren“) in i18n-Keys auslagern und EN/DE befüllen. |
| 4.4 | Export-Funktion (PDF/Excel) benennen | Einheitlicher Key z. B. `shifts.export_attendance` → „Export attendance“ / „Anwesenheit exportieren“; keine Mischung mit „PDF“. |

**Dateien:** `app/[org]/dashboard/page.tsx` (Schichtplan), `components/ShiftPlanWeekNav.tsx`, `components/ShiftEditModal.tsx`, `app/admin/shifts/page.tsx`, `lib/i18n.ts`.

---

## 5. Datenschutz & Rechtliches

**Ziel:** DSGVO-taugliche Basis: Datenschutz, AGB, Cookie-Hinweis, Löschfunktion, feinere Rollen.

| # | Task | Details |
|---|------|--------|
| 5.1 | Datenschutzerklärung | Statische Seite `/privacy` (oder `/datenschutz`) mit Inhalt: Verantwortliche, Zweck, Speicherdauer, Rechte (Auskunft, Löschung, Widerspruch), Empfänger (Supabase, ggf. E-Mail-Dienst), Hinweis auf Supabase (EU). |
| 5.2 | Nutzungsbedingungen | Statische Seite `/terms` (oder `/agb`) mit AGB-Text (Nutzung, Haftung, Kündigung). |
| 5.3 | Cookie-/Consent-Hinweis | Komponente z. B. `CookieBanner`: beim ersten Besuch Hinweis anzeigen, „Akzeptieren“/„Mehr erfahren“ (Link zu `/privacy`); Zustimmung in localStorage; Banner nicht erneut anzeigen. |
| 5.4 | Data-Deletion (Account/Org) | **Account:** In Einstellungen „Account löschen“ (Supabase User löschen oder deaktivieren; vorher Bestätigung). **Org:** Bereits Delete-Button für Super-Admin; für Org-Admins optional „Organisation löschen“ mit Bestätigung und Hinweis auf endgültige Löschung. |
| 5.5 | Rollen verfeinern (optional) | Zusätzliche Rolle z. B. „Viewer“ (nur Lesen) oder „Finance“ (nur Treasury); RLS und UI (Sidebar, Buttons) anpassen. Kann in späterer Phase erfolgen. |

**Dateien:** `app/privacy/page.tsx`, `app/terms/page.tsx`, `components/CookieBanner.tsx`, Layout für Banner; `app/[org]/settings` oder `/account` für Account-Löschung; Footer-Links zu Privacy/Terms.

---

## 6. User-Dashboard & Notifications

**Ziel:** Persönliche Ansicht für Mitglieder; Erinnerungen; optional Activity-Feed.

| # | Task | Details |
|---|------|--------|
| 6.1 | „Meine Aufgaben“ / „Meine Schichten“ | Eigener Bereich (z. B. Tabs oder Seite unter `/[org]/dashboard` oder `/[org]/me`): Aufgaben, bei denen aktueller User `owner_id` ist oder zugewiesen; Schichten, bei denen User in `shift_assignments` ist. Filter nach „offen“ / „erledigt“. |
| 6.2 | Schicht-Erinnerungen (E-Mail) | Cron-Job oder Serverless: Schichten in den nächsten 24h laden; für jede Zuweisung E-Mail an User senden (z. B. Resend/SendGrid). Bereits Stub unter `/api/cron/shift-reminders`; Versand implementieren und in Doku env (API-Key) beschreiben. |
| 6.3 | Activity-Feed (optional) | Tabelle oder View „letzte Aktivitäten“ (Aufgabe erledigt, Schicht bestätigt, Punkt vergeben); auf Dashboard oder eigener Seite anzeigen. Kann in späterer Phase. |

**Dateien:** `app/[org]/dashboard/page.tsx` oder `app/[org]/me/page.tsx`, API `tasks`/`shifts` mit Filter `owner_id`/`user_id`; `app/api/cron/shift-reminders/route.ts`, E-Mail-Client.

---

## 7. Self-Service erweitern (Logo, Plan, Sprache, Theme)

**Ziel:** Organisation verwaltet selbst: Logo, Plan-Anzeige/Upgrade, Sprache, Theme.

| # | Task | Details |
|---|------|--------|
| 7.1 | Logo-Upload | In `/[org]/settings`: Upload-Feld; Bild in Supabase Storage (Bucket pro Org oder global mit Pfad `orgs/{orgId}/logo`); URL in `organizations.logo_url` oder `settings.logo_url` speichern; in Layout/Header anzeigen. |
| 7.2 | Plan-Anzeige & Upgrade | Plan bereits in Settings sichtbar; optional: Link „Upgrade“ zu externer Pricing-Seite oder Checkout (Stripe); keine Änderung in dieser Phase nötig, wenn nur Anzeige gewünscht. |
| 7.3 | Sprache & Theme | Bereits umgesetzt (Theme in localStorage, Sprache in Cookie); nur prüfen, dass beide in allen Bereichen greifen und keine hart codierten Farben/Texte mehr brechen. |

**Dateien:** `app/[org]/settings/page.tsx`, neue Komponente `LogoUpload`, Supabase Storage Policy, `organizations`-Tabelle um `logo_url` erweitern (Migration).

---

## Empfohlene Reihenfolge

1. **1** (Dashboard absichern) – schnell, hoher Datenschutz-Nutzen  
2. **3** (i18n + Abitur-Reste) – verbessert Wahrnehmung „generisches Produkt“  
3. **4** (Schicht-Übersetzung + UX) – schließt letzte Lücken im Schichtmodul  
4. **2** (Self-Signup, Invite, E-Mail) – wichtig für Wachstum und DSGVO  
5. **5** (Datenschutz, AGB, Cookie, Löschung) – rechtliche Absicherung  
6. **7** (Logo, Self-Service) – erhöht Professionalität  
7. **6** (User-Dashboard, Notifications) – bessere Mitglieder-Bindung  

---

## Hinweise

- Alle i18n-Keys in `lib/i18n.ts` anlegen und in beiden Locales (en/de) pflegen.
- RLS bei neuen Tabellen oder geänderten Zugriffslogiken anpassen und testen.
- E-Mail-Versand (Reminder, Verifizierung, Reset) erfordert Konfiguration in Supabase und ggf. externem Provider (Resend etc.); env-Variablen dokumentieren.
