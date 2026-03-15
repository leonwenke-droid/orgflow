# OrgFlow — Aktueller Stand & offene Punkte

Stand: März 2025. Abgleich mit Codebase und Roadmap.

---

## Bereits umgesetzt

| Bereich | Status | Hinweis |
|--------|--------|---------|
| **Landingpage & Onboarding** | ✅ | Generisch (Schulen, Clubs, NGOs, Event-Crews); Org-Typ + Module; „Events“ coming soon |
| **Modulares Dashboard** | ✅ | Sidebar & Dashboard nach gewählten Modulen |
| **Event-Entity** | ✅ | Tabelle `events`, `event_id` in shifts/tasks, `/[org]/admin/events` mit Anlegen & Liste |
| **Shifts ↔ Events** | ✅ | Optionales Event-Dropdown beim Anlegen von Shifts/Tasks |
| **Self-Sign-Up (Shifts)** | ✅ | „Sign up“ für freie Schichten im Dashboard; Auto-Assignment vorhanden |
| **i18n (DE/EN)** | ⚠️ Teilweise | Viele Keys in `lib/i18n.ts`, Locale-Cookie, `t(key, locale)` in etlichen Komponenten; vereinzelt noch harte DE/EN-Strings |
| **Dark Mode** | ⚠️ Teilweise | `next-themes`/ThemeProvider + Inline-Script (`orgflow-theme` in localStorage) für FOUC-Vermeidung; ggf. fehlen noch konsistente `dark:`-Klassen |
| **Self-Service Orga** | ✅ | Name & Slug in `/[org]/settings` (EditOrgForm + updateOrganizationAction) |
| **Empty States & CTAs** | ✅ | `EmptyState` mit i18n (empty.*, cta.*); Onboarding-Banner mit Dismiss |
| **Passwort-Reset** | ✅ | „Forgot password?“ + `/auth/forgot-password` + API |
| **E-Mail-Hinweis** | ✅ | Banner bei nicht verifizierter E-Mail (`EmailVerificationBanner`) |
| **TGG/Legacy-Org** | ✅ | `getCurrentUserOrganization` löst TGG per Slug, wenn Org-Zeile andere ID hat |
| **Finance (Komma/Format)** | ✅ | `formatCurrency` / `parseTreasuryAmount` für DE/EN-Eingabe |

---

## Offene Punkte (priorisiert)

### 1. Internationalisierung vollständig

- [ ] Alle UI-Texte in i18n (keine deutschen Platzhalter wie „Titel“, „Beschreibung“, „Begründung“, „Punkte“ in Komponenten).
- [ ] Server-Actions: wo sinnvoll `errorKey` statt festem String zurückgeben, Client übersetzt mit `t(errorKey, locale)`.
- [ ] Prüfen: Tasks-Formular, Engagement, Members, Settings – keine gemischten DE/EN-Labels.

### 2. Dark Mode & Theme

- [ ] Sicherstellen, dass Theme nach Reload/Navigation wirklich persistent ist (Cookie oder localStorage + Script vor First Paint – bereits angelegt; ggf. prüfen ob Key/Name überall gleich).
- [ ] Dunkle Palette einheitlich: Karten, Hintergründe, Texte (`dark:` in `globals.css` und Komponenten).

### 3. Events vertiefen

- [ ] Shifts/Tasks beim Anlegen optional einem Event zuordnen (bereits Event-Dropdown; ggf. Filter in Listen).
- [ ] Filter in Shifts- und Tasks-Listen nach Event.

### 4. Schicht-Modul

- [ ] Reminder: E-Mail/Push vor Schichtbeginn (Resend, Supabase Edge, Cron).
- [ ] Optional: Schichttypen frei definierbar (z. B. „Bar“, „Security“) statt nur Recurring/Event.

### 5. Ressourcen-Modul generalisieren

- [ ] Kategorien (Small/Medium/Large) neutralisieren oder konfigurierbar; Beispiele ohne Abi-Kontext (z. B. „Consumables“, „Equipment“).
- [ ] Punktesystem optional oder pro Organisation konfigurierbar.

### 6. Finanzen-Modul

- [ ] Einnahmen-/Ausgaben-Log (Datum, Beschreibung, Betrag, Kategorie) statt nur Saldo.
- [ ] Mehrsprachige Labels; flexibles Template (kein festes M9).

### 7. Module dynamisch

- [ ] Nur gewählte Module in Sidebar/Navigation anzeigen (bereits org-spezifisch; prüfen ob überall an `modules` gehalten wird).
- [ ] Optional: vordefinierte Modulsets pro Organisationstyp.

### 8. Self-Service & Einstellungen

- [ ] Logo-Upload und Plan-Anzeige/Wechsel wo gewünscht.
- [ ] Sprache & Theme auf Organisationsebene speicherbar (derzeit eher User/Browser).

### 9. Permissions & Routing

- [ ] Slug-Konsistenz prüfen (z. B. „abi-2026-tgg“ vs „abi-2026-tg“); Middleware/Routing prüfen.
- [ ] „Keine Berechtigung“ nur anzeigen, wenn Nutzer tatsächlich kein Admin ist; Rollen/RLS prüfen.

### 10. Sicherheit & Performance

- [ ] Rate Limiting (API/Login).
- [ ] E-Mail-Verifizierung erzwingen (Supabase + App).
- [ ] Alle Abfragen organisationsgefiltert (RLS); keine Datenlecks.

### 11. Onboarding & Registrierung

- [ ] Leerzustände mit klaren CTAs („Create your first task“, „Invite members“) – teils schon; restliche prüfen.
- [ ] Optional: Progress/Onboarding-Tipps nach Orga-Erstellung (Teams, Mitglieder, erste Task/Shift).
- [ ] Optional: Sign-up während Onboarding (derzeit Account vorher nötig).

---

## Kurzfassung

- **Stark:** Generisches Onboarding, modulare Navigation, Events-Entity, Self-Sign-Up, Passwort-Reset, Orga-Self-Service, TGG-Fix, Finance-Format.
- **Noch zu tun:** i18n lückenlos, Dark Mode konsistent, Events-Filter, Schicht-Reminder & -Typen, Ressourcen/Finanzen generischer, Modul-Sichtbarkeit, Permissions/Routing prüfen, Rate Limiting & E-Mail-Verifizierung.

Wenn du willst, können wir mit einem der offenen Punkte starten (z. B. „i18n vollständig“ oder „Events-Filter“).
