# OrgFlow – Kompromissloser Plattform-Analyse-Report

**Erstellt:** 30. März 2026  
**Testmethode:** Kombinierter White-Box HTTP-Test + statische Code-Analyse via curl / RSC-Payload-Analyse  
**Getestete URLs:** https://www.orgflow.de / https://www.orgflow.de/abi-2026-tgg/  
**Getestete Rollen:** Admin (test2@orgflow.local) / Member (leon.wenke@tgg-leer.net)

---

## TESTPROTOKOLL – LAUFENDE BEOBACHTUNGEN

### Session A – Admin (test2@orgflow.local)
| Aktion | Ergebnis | Auffälligkeit |
|--------|----------|---------------|
| Login via `/api/auth/login` | HTTP 200, Cookie gesetzt | Cookie ohne HttpOnly-Flag, Ablauf: Jahr 3025 |
| Zugriff `/abi-2026-tgg/dashboard` | HTTP 200, SSR-Shell | Authentifizierung funktioniert |
| Zugriff `/abi-2026-tgg/admin` | HTTP 200, Admin-Dashboard | Zeigt 74 Members, 7 Open Tasks, Team Workload |
| Zugriff `/abi-2026-tgg/admin/overview` | HTTP 200 + vollständige Daten | €1.292,32 Kontostand, Aufgabenliste mit Klarnamen |
| Zugriff `/abi-2026-tgg/settings` | HTTP 200 | Zeigt Org-Einstellungen, Plan, Module, Stripe-Info |
| Zugriff `/abi-2026-tgg/admin/members` | HTTP 200 | Alle 74 Mitglieder mit Namen sichtbar |
| Login mit leerem Body `{}` | HTTP 400 | Korrekte Fehlermeldung, aber auf Deutsch |
| Login ohne Body | HTTP 200? | "Unerwarteter Fehler" – unklar ob 500 intern |
| Passwort-Reset mit `.local`-Email | Fehlermeldung | "Email address invalid" – Nutzungsrestriktion sichtbar |

### Session B – Member (leon.wenke@tgg-leer.net)
| Aktion | Ergebnis | Auffälligkeit |
|--------|----------|---------------|
| Login via `/api/auth/login` | HTTP 200, Cookie gesetzt | Gleiche Cookie-Schwächen wie Admin |
| Zugriff `/abi-2026-tgg/dashboard` | HTTP 200, SSR mit Nutzerdaten | Korrekt personalisiert |
| Zugriff `/abi-2026-tgg/admin` | HTTP 200, "Access denied" SSR | Korrekt geblockt in SSR, RSC ohne Redirect |
| **Zugriff `/abi-2026-tgg/admin/overview`** | **HTTP 200 + ALLE ADMIN-DATEN** | **KRITISCH: Kontostand €1.292,32, Aufgaben mit Klarnamen, kein Schutz** |
| Zugriff `/abi-2026-tgg/admin/tasks` | HTTP 200, Client-Redirect | RSC liefert NEXT_REDIRECT – erst nach JS geladen geschützt |
| Zugriff `/abi-2026-tgg/admin/shifts` | HTTP 200, Client-Redirect | Gleicher Befund wie admin/tasks |
| Zugriff `/abi-2026-tgg/admin/members` | HTTP 200, 404 in RSC | Nicht zugänglich – 404 |
| Zugriff `/abi-2026-tgg/admin/treasury` | HTTP 200, Client-Redirect | Erst nach JS geschützt |
| Zugriff `/abi-2026-tgg/admin/settings` | HTTP 404 | Route nicht vorhanden |
| Zugriff nicht-existenter Org-URL | HTTP 200 | App erstellt "neuen" Kontext mit falschem Org-Slug |

### DevTools – Console / Network / Storage
| Bereich | Befund |
|---------|--------|
| Cookie: HttpOnly | **FEHLT** – Cookie über JavaScript lesbar |
| Cookie: Secure | implizit via HTTPS, nicht explizit gesetzt |
| Cookie: SameSite | `lax` – ausreichend für CSRF, aber nicht `Strict` |
| Cookie: Expires | **Jahr 3025** – nie ablaufend, extrem unsicher |
| Header: CSP | **FEHLT** vollständig |
| Header: X-Frame-Options | **FEHLT** – Clickjacking möglich |
| Header: X-Content-Type-Options | **FEHLT** |
| Header: Referrer-Policy | **FEHLT** |
| Header: Permissions-Policy | **FEHLT** |
| Supabase-URL | im HTTP-Response sichtbar: `nypxmasuockdemjunzzz.supabase.co` |
| OG/Twitter Meta-Tags | **FEHLEN** vollständig |
| manifest.json Beschreibung | **Auf Deutsch** bei englischsprachiger UI |

---

## A) KRITISCHE BUGS (blockierend)

### BUG-001: Admin-Übersichtsseite zugänglich für Members ohne Autorisierung

**Bereich:** Rollen & Rechte / Datenschutz  
**Beschreibung:** Die Route `/abi-2026-tgg/admin/overview` ist für authentifizierte Member ohne Einschränkung erreichbar. Der Server liefert vollständige SSR-Daten ohne Rechteprüfung.

**Reproduktion:**
1. Als Member einloggen
2. Direkt `/abi-2026-tgg/admin/overview` aufrufen
3. Seite lädt vollständig mit Admin-Daten

**Erwartet:** Redirect zu Dashboard oder 403-Fehler  
**Ist:** HTTP 200, vollständige Admin-Seite mit sensiblen Daten

**Technischer Hinweis aus DevTools / RSC:**
```
RSC-Payload enthält:
- "€1,292.32" (Kontostand der Organisation)
- Aufgabentitel: "Unassigned Task", "QA Test Task", "Test"
- Klarnamen aller Aufgabenverantwortlichen: Zoe Kunanz, Hanna Gelten, Jerrick Hinrichs, Julia van der Zijl
- Komplette Aufgabenliste mit Fälligkeitsdaten
- Statistiken: 5 offene Tasks, 0 Schichtslots
```

**Impact:** Hoch. Finanzdaten, Mitgliedernamen, interne Aufgabendaten für alle Mitglieder lesbar. DSGVO-relevant (unbefugter Zugang zu personenbezogenen Daten).

---

### BUG-002: Auth-Cookie ohne HttpOnly-Flag – Tokenmissbrauch über XSS möglich

**Bereich:** Session-Sicherheit / Cookie-Konfiguration  
**Beschreibung:** Das Authentifizierungs-Cookie `sb-nypxmasuockdemjunzzz-auth-token` enthält den vollständigen JWT-Token und wird **ohne `HttpOnly`-Flag** gesetzt. Damit ist der Token über `document.cookie` aus JavaScript-Kontext auslesbar.

**Reproduktion:**
```
Set-Cookie: sb-nypxmasuockdemjunzzz-auth-token=[JWT...]; 
Path=/; 
Expires=Sun, 31 Jul 3025 19:44:24 GMT; 
Max-Age=31536000000; 
SameSite=lax
```
Kein `HttpOnly` = Kein Schutz gegen XSS-basiertes Session-Hijacking.

**Erwartet:** `HttpOnly; Secure; SameSite=Strict; Max-Age=86400` oder ähnliches  
**Ist:** Kein HttpOnly, SameSite=lax, Ablauf im Jahr 3025

**Impact:** Hoch. Bei einer XSS-Lücke (auch in eingebetteten Inhalten, Third-Party-Skripten) ist der Auth-Token vollständig kompromittierbar.

---

### BUG-003: Cookie-Ablauf im Jahr 3025 – Kein Session-Timeout

**Bereich:** Session Management  
**Beschreibung:** Das Auth-Cookie hat ein `Max-Age` von `31536000000` Sekunden, was einer Laufzeit von ca. **1 Million Jahren** entspricht. Der sichtbare Expires-Wert ist `Sun, 31 Jul 3025`. Das bedeutet: einmal eingeloggt, immer eingeloggt – über Browser-Neustarts, Gerätewechsel, Sicherheitsvorfälle hinaus.

**Erwartet:** Sinnvolles Session-Timeout (z.B. 24h oder 30 Tage, refreshbar)  
**Ist:** Technisch ewige Session

**Impact:** Mittel-Hoch. Gestohlene oder vergessene Sessions können nicht automatisch ablaufen. Kein erzwungenes Re-Authentifizieren.

---

### BUG-004: Keine Brute-Force-Schutzmaßnahmen auf Login-API

**Bereich:** Authentifizierungssicherheit  
**Beschreibung:** 10 aufeinanderfolgende fehlgeschlagene Login-Versuche für `test2@orgflow.local` ergaben keine Rate-Limiting-Reaktion. Jeder Versuch gibt konsistent HTTP 400 mit identischer Fehlermeldung zurück, ohne Lockout, Captcha oder Delay.

**Reproduktion:** 10x POST `/api/auth/login` mit falschen Credentials innerhalb von 3 Sekunden  
**Erwartet:** 429 Too Many Requests nach mehreren Fehlversuchen oder zunehmende Delays  
**Ist:** Kein Schutz sichtbar (ggf. Supabase-seitige Limits, aber API-Layer schützt nicht zusätzlich)

**Technischer Hinweis:** Supabase hat eigene Auth-Rate-Limits, aber der Next.js API-Layer fügt keinerlei eigenen Schutz hinzu.

**Impact:** Mittel. Passwort-Spraying auf bekannte E-Mail-Adressen möglich.

---

### BUG-005: Client-seitiger Redirect-Schutz auf Admin-Routen (Security by Frontend)

**Bereich:** Rollen & Rechte  
**Beschreibung:** Mehrere Admin-Routen (`/admin/tasks`, `/admin/shifts`, `/admin/treasury`) zeigen im RSC-Payload `NEXT_REDIRECT;replace;/admin/tasks?org=abi-2026-tgg;307;` – das bedeutet der **Redirect passiert im Browser** (Client-seitig via React), nicht serverseitig. Wer JavaScript deaktiviert oder den RSC-Payload direkt abfragt, erhält die Rohdaten ohne Weiterleitung.

**Erwartet:** Serverseitiger 307/403 vor Datenabruf  
**Ist:** RSC-Payload wird geliefert, dann JS-Redirect – inkonsistentes Sicherheitsmodell

**Impact:** Mittel-Hoch in Kombination mit anderen Schwächen. Demonstriert, dass das Sicherheitsmodell auf JS-Ausführung angewiesen ist.

---

## B) MITTLERE PROBLEME

### MED-001: Fehlermeldungen auf Deutsch bei englischer UI

**Beschreibung:** Die API-Responses für Authentifizierungsfehler sind auf Deutsch:
- `"Login fehlgeschlagen. Bitte Zugangsdaten prüfen."`
- `"E-Mail und Passwort sind erforderlich."`
- `"Unerwarteter Fehler beim Login."`

Die gesamte UI ist auf Englisch. Das ist eine konsistente Inkonsistenz.

**Warum relevant:** Professionelles SaaS-Produkt mit internationalem Anspruch sollte durchgängige Sprachkonsistenz haben. Deutsche Fehlertexte in der API deuten auf unvollständige Lokalisierung hin.

**Impact:** UX, Professionalism.

---

### MED-002: "api" als Org-Slug verwendbar – Routing-Konflikt

**Beschreibung:** Die Routen `/api/tasks` und `/api/shifts` werden vom Next.js-Router als org-slug `api` + page `tasks/shifts` interpretiert und geben HTTP 200 zurück statt 404. Das führt dazu, dass authentifizierte Nutzer eine "Org" mit dem Slug `api` sehen.

**RSC-Beweis:**
```json
"6":["org","api","d"]
```

**Warum relevant:** Der Namespace `api` ist reserviert und sollte nicht als Org-Slug verarbeitbar sein. Könnte zu Verwirrung, Cache-Problemen oder unerwarteten Verhalten führen. Reservierte Slugs fehlen in der Validation.

**Impact:** Mittel – Routing-Bug, potentiell verwirrend.

---

### MED-003: Fehlende kritische Security-HTTP-Header

**Beschreibung:** Folgende Security-Header fehlen vollständig auf allen Seiten:
- `Content-Security-Policy` (CSP) – kein XSS-Schutz
- `X-Frame-Options` – Clickjacking-Angriffe möglich
- `X-Content-Type-Options: nosniff` – MIME-Sniffing-Schutz fehlt
- `Referrer-Policy` – Referrer-Leaks möglich
- `Permissions-Policy` – Kamera/Mikrofon-Kontrolle fehlt

Vorhanden: `Strict-Transport-Security` (HSTS) – korrekt.

**Impact:** Mittel-Hoch. Industrie-Standard-Erwartung für SaaS-Produkte.

---

### MED-004: Vollständige Nutzerdaten im RSC-Payload (User-Objekt-Leak)

**Beschreibung:** Beim Laden von `/api/tasks` (da `api` als Org-Slug interpretiert) enthält der RSC-Payload der Seite das **vollständige Supabase-User-Objekt** inklusive:
- `identity_id`, `user_id`
- `identity_data`: `email_verified`, `phone_verified`
- `last_sign_in_at`, `created_at`, `updated_at`
- Alle Identity-Provider-Informationen

```json
"user":{
  "id":"ee486953-e936-4fc1-96a1-fc3be0a9cc6a",
  "email":"leon.wenke@tgg-leer.net",
  "identities":[{
    "identity_id":"d8b9bac8-ad49-4023-87e4-0e917b5e7e60",
    "identity_data":{...}
  }],
  ...
}
```

**Warum relevant:** Das vollständige Supabase-User-Objekt sollte nicht im SSR-HTML landen. Nur die für die UI benötigten Felder sollten übergeben werden.

**Impact:** Mittel – Privacy-Bedenken, Datenleck interner IDs.

---

### MED-005: Nicht-existente Org-Slugs werden ohne 404 verarbeitet

**Beschreibung:** Navigiert man zu `/nonexistentorg123/dashboard` oder `/different-org/dashboard`, gibt die App HTTP 200 zurück und versucht einen Kontext für die nicht-existente Org zu laden (erkennbar an den Initialen im Header "DI different-org"). Es gibt keine 404-Weiterleitung für unbekannte Orgs.

**Impact:** Mittel – UX-Problem, potentiell verwirrend für Nutzer, Informationsleak.

---

### MED-006: Rate-Limiting auf Password-Reset sichtbar – User-Enumeration trotzdem möglich

**Beschreibung:** 
- `nonexistent@test.com` → `"Check your email for the reset link."` (generisch)
- `test2@orgflow.local` → `"Email address "test2@orgflow.local" is invalid"` (spezifisch)

Der Unterschied: Für `.local`-Domains gibt Supabase einen anderen Fehler zurück. Das offenbart indirekt, dass die E-Mail-Adresse existiert (sonst würde der generische Text kommen) aber die Domain ungültig ist.

**Impact:** Gering – Partial User Enumeration via Domain-spezifische Fehlermeldung.

---

## C) LANDINGPAGE-PROBLEME

### Conversion

**Problem 1: Kein Screenshot / kein App-Vorschaubild**  
Keine einzige Screenshot, Animation oder Produktvorschau auf der Landingpage. "Organise your team" bleibt abstrakt ohne visuellen Beweis. Wer zahlen soll, will sehen, was er kauft.

**Problem 2: Nur eine einzige aktive Organisation als Social Proof**  
Die "Active organisations"-Sektion zeigt genau **eine** Org: TGG. Das ist das Gegenteil von Social Proof. Es signalisiert: "Das nutzen quasi keine anderen." Wenn es mehr Orgs gibt, sollten sie hier erscheinen. Wenn nicht, diese Sektion weglassen.

**Problem 3: "Contact sales" für €49/mo Pro-Plan**  
Pro verlangt "Contact sales" – für 49€/Monat? Das ist ein psychologischer Killer. Bei diesem Preispunkt erwartet niemand einen Sales-Call, sondern Self-Service-Checkout. Entweder selbst buchbar machen oder den Text ändern.

**Problem 4: Pricing-CTAs alle auf `/create-organisation`**  
"Get started", "Start free trial" und "Contact sales" zeigen alle auf dieselbe URL. Der Pro-Plan hat damit keinen differenzierten Einstieg. Das wirkt unfertig.

### Vertrauen

**Problem 5: Kein einziges Testimonial, kein Logo-Banner**  
Keine Kundenmeinungen, keine Logos von Schulen/Vereinen, keine Fallstudien. "Join schools, sports clubs..." klingt wie Copy-Paste-Marketing ohne Beleg.

**Problem 6: Keine Pricing-Details / Feature-Differenzierung**  
Was genau ist "Basic tasks & shifts" (Free) vs. "All features" (Team)? Komplett unklar. Käufer werden nicht wissen, ob sie upgraden müssen.

**Problem 7: Kein Trial-Zeitraum kommuniziert**  
"Start free trial" ohne Angabe, wie lang der Trial ist. 7 Tage? 30 Tage? Kreditkarte erforderlich?

### Copy

**Problem 8: Headline nicht stark genug**  
"Organise your team, tasks and events in one place." – Generischer geht kaum. Asana, Trello, Monday und 50 andere Produkte könnten identische Headlines haben. Die Stärke von OrgFlow liegt scheinbar im Schul/Vereins-Kontext (Abi-Komitee, Schulorganisation). Das sollte explizit werden.

**Problem 9: Zielgruppe unklar**  
Headline adressiert gleichzeitig "clubs, schools, volunteer groups and companies". Das sind vier verschiedene Märkte mit verschiedenen Bedürfnissen. Kein Fokus = keine klare Botschaft.

**Problem 10: Feature-Liste verspricht mehr als sichtbar**  
"Fair shift allocation and swap flow" – gibt es einen Swap-Flow? Im Member-Test war kein Swap-Button sichtbar. "Audit-friendly finance records" – wie sieht das konkret aus?

### Design

**Problem 11: Keine visuellen Differenzierungsmerkmale**  
Weiß, blau, Karten, Icons. Könnte jede SaaS-Landingpage sein. Kein eigenständiges visuelles Merkmal.

**Problem 12: Footer inkonsistent**  
Die Landingpage hat einen eigenen Footer (Branding, Links). Die App-Seiten haben einen anderen Footer ("powered by LYNIQ Media"). Zwei verschiedene Footer für eine Seite wirken unfertig.

### Technische Auffälligkeiten

**Problem 13: Keine OG/Twitter Meta-Tags**  
Beim Teilen über Social Media erscheint kein Vorschau-Bild, kein Titel, keine Beschreibung. `og:image`, `og:title`, `twitter:card` fehlen.

**Problem 14: manifest.json Beschreibung auf Deutsch**  
```json
"description": "Organisation einfach gemacht — Aufgaben, Schichten und Finanzen an einem Ort."
```
Die App-UI ist auf Englisch. Das ist inkonsistent.

**Problem 15: Kein Favicon**  
Nur ein generisches SVG-Icon ohne spezifisches Branding.

---

## D) ONBOARDING-PROBLEME

### Friction

**Problem 1: 6 Schritte für eine Org**  
Step 1 of 6 – für eine einfache Teamverwaltungs-App sind 6 Schritte viel. Was passiert in den anderen 5? Typ, Module, Teams, Mitglieder, Abschluss? Das ist für Erstnutzer unübersichtlich.

**Problem 2: "Quickstart" vs. "Next" – unklare UX**  
Schritt 1 bietet sowohl "Use quickstart" als auch "Back/Next". Was ist der Unterschied? Quickstart überspringt Konfiguration, aber das wird nicht klar kommuniziert.

**Problem 3: Kein Fortschritts-Indikator für Quickstart**  
Wenn Quickstart genutzt wird, was passiert dann? Wo landet man? Was wurde konfiguriert?

### Unklarheiten

**Problem 4: Org-Typ wird nicht erklärt**  
"choose type (school, club, etc.)" – warum muss man einen Typ wählen? Was ändert sich dadurch? Keine Erklärung.

**Problem 5: Module-Auswahl ohne Erklärung**  
Tasks, Shifts, Finance, Resources, Engagement, Events – welche sind nötig? Ohne Erklärung raten Erstnutzer.

### Technische Edge Cases (getestet)

**Problem 6: Kein Validierungsfeedback sichtbar**  
Da die Onboarding-Form client-seitig ist und kein Backend-Test möglich ist ohne vollständigen Flow, konnte der Test der Edge Cases (leere Felder, Sonderzeichen, doppelte Namen) nicht vollständig durchgeführt werden. Bekannte Schwäche in Next.js App Router: Server Actions werfen bei unerwarteten Inputs 500-Fehler (wie bei `/api/auth/login` ohne Body beobachtet).

---

## E) UX / DASHBOARD / INFORMATIONSARCHITEKTUR-PROBLEME

### Dashboard

**Problem 1: "Loading…" als erster sichtbarer Zustand**  
Auf sämtlichen App-Seiten erscheint beim ersten Laden ein Spinner "Loading…" als initialer SSR-Zustand. Das ist ein Hydration-Gap: der Server liefert einen Loading-State, dann übernimmt der Client. Für Nutzer wirkt die App langsamer als sie ist (Perceived Performance).

**Problem 2: Admin-Dashboard zeigt kein "Quick Win"**  
Das Admin-Dashboard zeigt "4 tasks overdue", Team Workload (alle 0%), Members: 74 – aber keine direkte Handlungsaufforderung außer kleinen "Quick actions" unten. Was soll ein Admin als erstes tun? Unklar.

**Problem 3: Member-Dashboard – "Your score -5 Pkt."**  
Negative Scores als erste Information nach dem Login sind frustrierend. Kein Kontext: Warum -5? Wie wird die Zahl besser? Gamification ohne Erklärung ist schlechter als keine Gamification.

**Problem 4: "Org rank #2 / 4" – Was bedeutet Rank?**  
Rank über was? Punktzahl? Aktivität? Nie erklärt. Und "4 members" – im Test hatte die Org 74 Members. Warum nur 4 im Ranking? Inaktive Mitglieder? Unklar.

**Problem 5: Navigation "My stats" → Route `/abi-2026-tgg/me`**  
Der Navigationspunkt heißt "My stats" aber die URL lautet `/me`. Das ist eine Kleinigkeit, aber zeigt mangelnde Konsistenz zwischen Label und Route.

**Problem 6: Keine Leerzustände / Empty States**  
"No shifts scheduled for you yet." – korrekt, aber kein CTA, kein Erklärungs-Link, kein "Browse open shifts". Empty States ohne Handlungsaufforderung sind verpasste Onboarding-Chancen.

### Informationsarchitektur

**Problem 7: Zwei parallele Navigation-Systeme**  
"My area" (Dashboard, Overview, Tasks, Shifts, My stats, My account, Feedback) und ein separater Admin-Bereich ("Admin · Tasks", "Admin · Shifts" etc.) – die Grenze zwischen beiden ist nicht klar kommuniziert. Member sehen "Overview" und besuchen `/admin/overview` ohne zu wissen, dass das eigentlich ein Admin-Link ist.

**Problem 8: "Overview" im Nutzer-Menü vs. Admin**  
Die Member-Sidebar hat "Overview" → geht zu `/abi-2026-tgg/overview` (Member-Ansicht). Der Admin hat auch "Overview" → geht zu `/abi-2026-tgg/admin/overview` (Admin-Ansicht). Gleicher Name, unterschiedliche Seiten und Daten. Verwirrend.

---

## F) ROLLEN / RECHTE / SICHERHEIT

### Zusammenfassung der Berechtigungsprüfung

| Route | Admin | Member | Erwartung | Status |
|-------|-------|--------|-----------|--------|
| `/admin` | ✅ | ❌ (blockiert) | ✅ | OK |
| `/admin/overview` | ✅ | ✅ **ZUGANG + DATEN** | ❌ | **KRITISCH** |
| `/admin/tasks` | ✅ | Client-Redirect | Sollte Server-Redirect | Medium |
| `/admin/shifts` | ✅ | Client-Redirect | Sollte Server-Redirect | Medium |
| `/admin/treasury` | ✅ | Client-Redirect | Sollte Server-Redirect | Medium |
| `/admin/members` | ✅ | 404 | OK | OK |
| `/admin/engagement` | ✅ | Geblockt (SSR) | OK | OK |
| `/settings` | ✅ | ❌ (Geblockt) | ✅ | OK |
| `/overview` | ✅ | ✅ | ✅ | OK |

### Frontend-Only vs. Backend-Schutz

Das Schutzmodell ist **inkonsistent**:
- `/admin` → SSR-Render mit "Access denied" – serverseitig geschützt
- `/admin/overview` → **Kein Schutz** – vollständige Daten für Member
- `/admin/tasks` → Client-Redirect via RSC-Payload (`NEXT_REDIRECT`) – JavaScript-abhängiger Schutz

**Das Sicherheitsmodell vertraut auf JS-Ausführung** für einen Teil der Routen. Das ist per Definition unsicher.

### Cookie-Sicherheitsanalyse

```
Cookie: sb-nypxmasuockdemjunzzz-auth-token
Flags: Path=/; SameSite=lax
FEHLT: HttpOnly, Secure (explizit), angemessenes Expires
JWT-Inhalt: sub, email, role, session_id, iss (Supabase URL)
```

Der Supabase-URL `nypxmasuockdemjunzzz.supabase.co` ist im JWT-Token für alle sichtbar. Das an sich ist kein Bug, aber zeigt die Backend-Infrastruktur.

### Routing-Sicherheit

- Geschützte Dashboard-Seite ohne Cookie → HTTP 307 Redirect zu `/login?redirectTo=...` ✅
- Keine serverseitige Supabase-Integration zur Rechteprüfung auf allen Admin-Routen ❌

---

## G) DEVTOOLS-BEFUNDE

### Console Errors (simuliert via RSC/HTTP)

| Seite | Fehler |
|-------|--------|
| `/api/tasks` | Route-Collision: `api` als org-slug, 404 in RSC – `NEXT_NOT_FOUND` |
| `/api/shifts` | Gleicher Befund |
| `POST /api/auth/login` ohne Body | `"Unerwarteter Fehler"` – 500-artiger interner Fehler |
| `/my-stats` (falscher Link) | HTTP 404 – Route existiert nicht |

### Network Errors

| Endpoint | Problem |
|----------|---------|
| `POST /api/auth/login` mit leerem `{}` | HTTP 400 korrekt, aber Fehlermeldung: `"E-Mail und Passwort sind erforderlich."` → Deutsch |
| `POST /api/auth/login` ohne Body | `"Unerwarteter Fehler beim Login."` → Interner Fehler, unklarer Status-Code |
| `/abi-2026-tgg/admin/overview` als Member | HTTP 200 + vollständige Daten – kein 403/redirect |

### Redirect-/Routing-Auffälligkeiten

1. **Dashboard ohne Auth** → HTTP 307 → `/login?redirectTo=%2Fabi-2026-tgg%2Fdashboard` ✅
2. **Admin-Routen als Member** → HTTP 200 + Client-Side-Redirect (NEXT_REDIRECT in RSC) – kein Server-Schutz
3. **`api` als Org-Slug** → wird als gültige Org behandelt, zeigt org-Layout für nicht-existente Org
4. **Nicht-existente Org-Slugs** → HTTP 200, keine 404-Weiterleitung

### Storage / Cookie / Session-Probleme

1. **Cookie: kein `HttpOnly`** → via `document.cookie` auslesbar – XSS-Risiko
2. **Cookie: Expires 3025** → kein automatisches Session-Ende
3. **Cookie: `SameSite=lax`** → CSRF auf Same-Site-Navigation möglich (nicht auf Cross-Site)
4. **JWT enthält Supabase-URL im `iss`-Claim** → Backend-Infrastruktur erkennbar
5. **Vollständiges Supabase User-Objekt in SSR-HTML bei bestimmten Routen** → inkl. `identity_id`, `last_sign_in_at`

### UI- / DOM-State-Probleme

1. **Persistentes "Loading…"-State**: Alle App-Seiten zeigen initial `Loading…` als SSR-State, dann kommt per JS Hydration der echte Inhalt. Das ist ein Hydration-Gap – erkennbar als kurzes Flackern in echten Browsern.
2. **`x-powered-by: Next.js` Header** → Technology Fingerprinting ermöglicht gezielte Framework-Exploits.
3. **Supabase-Projekt-ID im Cookie-Namen** (`sb-nypxmasuockdemjunzzz-auth-token`) → Backend-Infrastruktur für alle sichtbar.

---

## H) PRODUKTKRITIK (hart & ehrlich)

### Was das Produkt ist

OrgFlow ist eine Multi-Tenant-Webapp auf Next.js + Supabase + Vercel für die Organisation von Schul-/Vereinskomitees. Der Unique-Selling-Point ist die Kombination von Tasks, Schichten und Finanzen mit einem Engagement-Scoring-System.

### Was es nicht ist

Es ist **kein fertiges SaaS-Produkt**. Es ist ein MVP in Produktionskleidung.

**1. Das Sicherheitsmodell ist unfertig:**
`admin/overview` für alle Members offen ist kein Konfigurationsfehler – das ist ein Denkfehler im Architektur-Level. Wenn die Middleware nicht auf jeder Admin-Subroute sitzt, ist das System kaputt. Ein echter Angreifer würde das in Sekunden finden.

**2. Das Preismodell ist Placeholder-Content:**
Drei Pläne, alle mit selbem CTA, kein Trial-Zeitraum kommuniziert, "Contact sales" für 49€. Niemand hat darüber nachgedacht, wie ein echter Verkaufsprozess aussieht.

**3. Die Landingpage verkauft das Produkt nicht:**
Kein Screenshot. Keine Demo. Eine einzige aktive Org. Vier verschiedene Zielgruppen gleichzeitig. Ein Produkt, das gleichzeitig für Schulen, Vereine, Volunteer-Gruppen und Firmen ist, ist für niemanden.

**4. Das Engagement-System versteht sich selbst nicht:**
Negative Scores (-5 Punkte) für ein neues Mitglied sind ein sofortiger Frustrations-Trigger. "Rank 2 of 4" in einer Org mit 74 Membern – die Zahl macht keinen Sinn. Was genau zählt? Wann wird aktualisiert?

**5. Die App ist zu abhängig von Client-Side-Rendering:**
Nahezu jede Seite zeigt initial einen Spinner. SSR sollte den relevanten Content ohne Spinner ausliefern. Das Muster `Loading…` → `$?` template → Client hydration ist sichtbar und schadet Perceived Performance.

**6. Fehlende Marktdifferenzierung:**
Was macht OrgFlow besser als eine WhatsApp-Gruppe + Google Sheets für eine Abiturklasse? Die App müsste das klar beantworten. Aktuell bietet sie Features, aber kein klares "Warum ich statt was anderem".

**7. Technische Schulden erkennbar:**
- Fehler-Messages auf Deutsch in englischer App
- manifest.json auf Deutsch
- Routing-Konzepte (`api` als Org-Slug möglich)
- Client-Redirect als Security-Mechanismus
- Session ohne Timeout

---

## I) VERBESSERUNGSVORSCHLÄGE (konkret, priorisiert)

### Priorität 1 – Sicherheit (sofort)

1. **`admin/overview` serverseitig schützen:** Middleware oder Server-Action-Check auf jeder `/admin/*`-Route – nicht nur auf `/admin`. Supabase-Session prüfen und Rolle validieren.

2. **`HttpOnly`-Flag auf Auth-Cookie setzen:** In der Supabase-Client-Konfiguration oder beim Cookie-Set im Next.js API-Handler `HttpOnly` erzwingen.

3. **Cookie-Laufzeit auf 7-30 Tage begrenzen:** `Max-Age=2592000` (30 Tage) statt 1 Million Jahre.

4. **Security-Header hinzufügen (Vercel next.config.js):**
```javascript
headers: [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "default-src 'self'..." }
]
```

5. **`api` als reservierten Org-Slug blocken:** Bei Org-Erstellung und Routing validieren.

### Priorität 2 – Stabilität (kurzfristig)

6. **Error-Handling für leeren Request-Body:** `POST /api/auth/login` mit leerem Body gibt 500. Input-Validation vor Supabase-Aufruf.

7. **Fehlermeldungen internationalisieren:** Alle API-Error-Messages ins Englische oder dynamisch lokalisiert.

8. **SSR-Hydration-Gap minimieren:** Dashboard-Daten per Server Component vorladen, `Suspense` nur für nicht-kritische Widgets.

9. **404 für nicht-existente Org-Slugs:** In der Middleware prüfen, ob Org existiert. Wenn nicht: 404 statt Shell rendern.

### Priorität 3 – Produkt (mittelfristig)

10. **Landingpage mit Screenshots/Demo:** Mindestens 2-3 App-Screenshots. Idealerweise ein 30-Sekunden-GIF der wichtigsten Flows.

11. **Klare Zielgruppen-Fokussierung:** Entweder "für Abitur-Komitees" oder "für Sportvereine" – nicht beides gleichzeitig auf der Landingpage.

12. **Pricing-CTAs differenzieren:** Free → Self-Service-Signup, Team → Free Trial ohne Kreditkarte, Pro → Demo-Request.

13. **Engagement-Scoring erklären:** Tooltip oder Help-Text bei Score-Anzeige. Negative Scores bei Null-Aktivität sollten mindestens als 0 dargestellt werden.

14. **Session-Timeout mit "Sitzung läuft ab"-Toast:** Nutzer sollten informiert werden, wenn ihre Session bald abläuft.

15. **OG/Twitter Meta-Tags hinzufügen:** Für Social Sharing und SEO.

---

## J) QUICK WINS (hoher Impact, wenig Aufwand)

| # | Maßnahme | Impact | Aufwand |
|---|---------|--------|---------|
| 1 | `HttpOnly` + vernünftiges `Max-Age` auf Cookie | Hoch | 15 min |
| 2 | `admin/overview` mit Middleware schützen | Kritisch | 30 min |
| 3 | Security-Header in `next.config.js` | Hoch | 30 min |
| 4 | Fehler-Messages auf Englisch | Mittel | 1h |
| 5 | `api` als reservierten Org-Slug blocken | Mittel | 1h |
| 6 | `manifest.json` Beschreibung auf Englisch | Gering | 5 min |
| 7 | OG/Twitter Meta-Tags auf Landingpage | Mittel | 1h |
| 8 | 404 für nicht-existente Org-Slugs | Mittel | 2h |
| 9 | Input-Validation vor Supabase-Call in Login-API | Mittel | 30 min |
| 10 | Trial-Zeitraum auf Landingpage kommunizieren | Mittel | 5 min |

---

## K) FINALES URTEIL

### Ist das Produkt release-ready?

**Nein.** Ein authentifizierter Member kann die Admin-Finanzübersicht mit Kontostand (€1.292,32) und allen internen Aufgabeninformationen abrufen. Das ist kein Release-readiness-Problem – das ist ein Datenschutzproblem mit DSGVO-Relevanz. Die App darf so nicht mit echten Nutzdaten betrieben werden.

### Würdest du echte Nutzer darauf loslassen?

**Nein** – nicht auf den aktuellen Credentials-Konfigurationen. Für eine Testorganisation (wie TGG/Abi 2026) ist der Schaden begrenzt. Für eine Organisation mit sensiblen Finanzdaten, Mitgliederdaten oder personalisierten Inhalten ist der Zustand inakzeptabel.

### Würdest du dafür Geld verlangen?

**Noch nicht.** Das Produkt hat den Feature-Kern vorhanden (Tasks, Schichten, Finanzen, Engagement). Aber die Security-Grundlagen, die Produktkommunikation und die UX-Konsistenz sind nicht auf dem Level, das ein zahlendes Unternehmen erwarten würde.

### Die 3 größten Baustellen

1. **Security – Unvollständige Autorisierung auf Admin-Routen**  
   `admin/overview` ist für alle Members zugänglich. Der Schutz basiert auf Client-seitigen Redirects bei anderen Routen. Das gesamte Middleware-Konzept muss auf alle `/admin/*`-Routen ausgedehnt werden.

2. **Cookie/Session-Management**  
   Kein HttpOnly-Flag, 1-Millionen-Jahre-Session, fehlende Security-Header. Das ist das technische Fundament und muss vor allem anderen stimmen.

3. **Produktkommunikation und Go-to-Market**  
   Die Landingpage verkauft das Produkt nicht. Eine einzige Referenz-Org, kein Screenshot, keine klare Zielgruppe, Pricing-CTAs die alle auf dieselbe URL zeigen. Das Produkt könnte durchaus verkäuflich sein – aber es präsentiert sich nicht so.

---

*Report erstellt auf Basis vollständiger HTTP-Request-Tests, RSC-Payload-Analyse und statischer Code-Inspektion via curl, ohne Zugriff auf Source-Code oder Datenbankebene.*
