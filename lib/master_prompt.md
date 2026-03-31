# OrgFlow – Cursor AI Master-Prompt
> Diesen Prompt in Phasen in Cursor eingeben. Nie alle auf einmal.
> Jede Phase ist ein separater Chat oder eine separate Composer-Session.

---

## ⚠️ Vor dem Start: Kontext für Cursor

Füge dies **einmalig** als erstes in jeden neuen Cursor-Chat ein:

```
Dies ist OrgFlow – eine Multi-Tenant SaaS-App für Organisationen (Vereine, Schulen, NGOs, Unternehmen).
Stack: Next.js 14 (App Router), Supabase (PostgreSQL + Auth), Tailwind CSS, TypeScript strict mode.
Projekt-Struktur: app/ (routes), components/, lib/ (utilities), services/, types/, supabase/migrations/.
Alle Änderungen müssen TypeScript-konform sein, keine any-Types einführen, RLS-Policies respektieren.
```

---

## PHASE 1 — Kritische Bugs & Sicherheit
*Zuerst machen. Blockt alles andere.*

```
Bitte behebe folgende kritische Probleme in OrgFlow:

### 1. TGG-Hardcoding entfernen
Finde die Funktion `getOrgIdForData` (oder ähnlich benannt) die Slugs wie
'abi-2026-tgg' oder 'abi2026-tgg' auf eine hardcodierte UUID `TGG_ORG_ID` mappt.

Ersetze diesen Mechanismus durch einen generischen Slug-Alias-Ansatz:
- Füge der `organizations`-Tabelle ein Feld `slug_aliases TEXT[] DEFAULT '{}'` hinzu
- Schreibe eine Migration: `supabase/migrations/YYYYMMDDHHMMSS_add_slug_aliases.sql`
- Update die Funktion so, dass sie erst den Haupt-Slug sucht, dann in `slug_aliases`
- Alle Referenzen auf `TGG_ORG_ID` und die hardcodierten Slugs entfernen
- Stelle sicher, dass bestehende TGG-Daten durch den Alias weiter funktionieren

### 2. Race Condition beim Shift-Claim absichern
Finde `lib/claimShiftForMember.ts` (oder die Funktion die Schicht-Slots belegt).
Das Problem: Zwei Nutzer können gleichzeitig den letzten Slot claimen.

Erstelle eine neue Supabase RPC-Funktion in einer neuen Migration:
`supabase/migrations/YYYYMMDDHHMMSS_claim_shift_atomic.sql`

```sql
CREATE OR REPLACE FUNCTION claim_shift_slot_atomic(
  p_shift_id UUID,
  p_profile_id UUID,
  p_org_id UUID
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift shifts%ROWTYPE;
  v_current_count INT;
BEGIN
  -- Lock the shift row
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shift_not_found');
  END IF;
  
  -- Count current assignments
  SELECT COUNT(*) INTO v_current_count 
  FROM shift_assignments 
  WHERE shift_id = p_shift_id AND status != 'cancelled';
  
  IF v_current_count >= v_shift.required_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'shift_full');
  END IF;
  
  -- Check if already assigned
  IF EXISTS (SELECT 1 FROM shift_assignments WHERE shift_id = p_shift_id AND profile_id = p_profile_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_assigned');
  END IF;
  
  -- Insert assignment
  INSERT INTO shift_assignments (shift_id, profile_id, org_id, status)
  VALUES (p_shift_id, p_profile_id, p_org_id, 'confirmed');
  
  RETURN jsonb_build_object('success', true);
END;
$$;
```

Nutze diese RPC statt des direkten Inserts in `claimShiftForMember.ts`.

### 3. Enum-Werte übersetzen
Finde alle Stellen wo Datenbank-Enum-Werte direkt im UI gerendert werden.
Bekannte Fälle:
- `in_arbeit` → soll "In Arbeit" anzeigen
- `offen` → "Offen"  
- `erledigt` → "Erledigt"
- `ueberfaellig` → "Überfällig"

Erstelle `lib/formatters.ts` mit:
```typescript
export const TASK_STATUS_LABELS: Record<string, string> = {
  in_arbeit: 'In Arbeit',
  offen: 'Offen',
  erledigt: 'Erledigt',
  ueberfaellig: 'Überfällig',
  abgebrochen: 'Abgebrochen',
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  in_arbeit: 'bg-amber-100 text-amber-800',
  offen: 'bg-gray-100 text-gray-700',
  erledigt: 'bg-green-100 text-green-800',
  ueberfaellig: 'bg-red-100 text-red-800',
};

export function formatTaskStatus(status: string): string {
  return TASK_STATUS_LABELS[status] ?? status;
}
```

Ersetze alle direkten Status-String-Ausgaben im UI durch diese Formatter-Funktion.
Nutze die Color-Map für Status-Badges in Aufgaben-Listen.
```

---

## PHASE 2 — Internationalisierung (i18n)
*Alle gemischten Sprachstellen bereinigen.*

```
OrgFlow hat ein kritisches Sprachproblem: Englische und deutsche Strings sind
überall gemischt. Bitte bereinige das vollständig:

### 1. i18n-Datei erweitern
Öffne `lib/i18n.ts` (oder erstelle sie falls nicht vorhanden).
Füge alle fehlenden deutschen Übersetzungen hinzu. Bekannte englische Strings:

- "Create & edit (organisation)" → "Erstellen & bearbeiten"
- "All teams" → "Alle Teams"  
- "Download pending invites" → "Ausstehende Einladungen herunterladen"
- "Excel import" → "Excel-Import"
- "Last balance:" → "Letzter Kontostand:"
- "You can either enter the balance manually or update via Excel (.xlsx)" 
  → "Kontostand manuell eingeben oder per Excel (.xlsx) aktualisieren"
- "By default, Excel uses cell M9 as the balance" 
  → "Standardmäßig liest Excel Zelle M9 als Kontostand"
- "Only the finance team should change the balance"
  → "Nur das Finanzteam sollte den Kontostand ändern"
- "Supported: .xlsx, .xls, .csv | Required: member name | Optional: email, team, role"
  → "Unterstützt: .xlsx, .xls, .csv | Pflicht: Name | Optional: E-Mail, Team, Rolle"
- "Treasury" (Breadcrumb) → "Finanzen"
- "Sign up" (Schichtplan) → "Eintragen"

### 2. Breadcrumb "Treasury" → "Finanzen"
Finde alle Breadcrumb- und Title-Definitionen für die Treasury/Finanzen-Seite.
Der Sidebar-Link heißt "Finanzen" — der Breadcrumb und Seitentitel müssen 
dasselbe Label nutzen. Vereinheitliche auf "Finanzen" überall.

### 3. Teams-Seite
"Create & edit (organisation)" als Subtitle entfernen oder auf Deutsch übersetzen.
Ersetze durch: "Teams verwalten" als Untertitel.

### 4. Mitglieder-Seite  
Den englischen Inline-Text unter Excel-Import vollständig auf Deutsch bringen
(siehe Übersetzungen oben).

Gehe systematisch vor: `grep -r "english_string"` um alle Vorkommen zu finden,
nicht nur das erste.
```

---

## PHASE 3 — Design-System & Komponenten
*Die visuell größte Verbesserung.*

```
OrgFlow braucht ein konsistentes Design-System. Bitte implementiere folgendes:

### 1. Status-Badge Komponente
Erstelle `components/ui/StatusBadge.tsx`:

```typescript
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/formatters';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const label = TASK_STATUS_LABELS[status] ?? status;
  const colors = TASK_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colors}`}>
      {label}
    </span>
  );
}
```

### 2. Schichten-Verfügbarkeit Komponente
Erstelle `components/ui/ShiftAvailability.tsx`:

```typescript
interface ShiftAvailabilityProps {
  total: number;
  filled: number;
  showText?: boolean;
}

export function ShiftAvailability({ total, filled, showText = true }: ShiftAvailabilityProps) {
  const free = total - filled;
  const isFull = free === 0;
  const isAlmostFull = free === 1 && total > 1;
  
  const dotColor = isFull ? 'bg-red-500' : isAlmostFull ? 'bg-amber-500' : 'bg-green-500';
  const text = isFull 
    ? 'Belegt' 
    : `${free} von ${total} Plätzen frei`;
  
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-500">
      <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
      {showText && <span>{text}</span>}
    </span>
  );
}
```

Ersetze alle manuellen Ampel-Punkte + "X von Y frei"-Texte im gesamten Codebase
mit dieser Komponente.

### 3. Button-Hierarchie vereinheitlichen
Erstelle `components/ui/Button.tsx` (falls noch nicht vorhanden oder erweitern):

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border-transparent',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
  destructive: 'bg-white text-red-600 hover:bg-red-50 border-red-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};
```

Gehe durch alle Seiten und ersetze direkte Tailwind-Button-Klassen mit dieser
Komponente. Besonders wichtig:
- "Löschen"-Buttons → variant="destructive"
- "Zurück"-Links → variant="ghost"  
- Haupt-CTAs pro Seite → variant="primary"
- Sekundäre Aktionen → variant="secondary"

### 4. Page-Header vereinfachen
Der aktuelle Header `"OrgFlow – Abitur 2026 - Teletta-Groß-Gymnasium Leer"` 
ist auf jeder Seite identisch und redundant (Org-Name steht schon in der Sidebar).

Finde den Header-Component (wahrscheinlich in `components/layout/` oder `app/[org]/layout.tsx`).

Ändere ihn so:
- Zeige NUR den Seitennamen (z.B. "Dashboard", "Aufgaben", "Finanzen")
- Den Org-Namen kleiner und gedimmt darunter, wenn überhaupt
- Oder: Header zeigt nur Breadcrumb + Seitentitel, Org-Name bleibt in der Sidebar
```

---

## PHASE 4 — Navigation & Sidebar
*Struktur und Rollen-Trennung.*

```
Die Sidebar-Navigation in OrgFlow hat zwei Probleme:
1. Zu viele Items auf einmal (12+) ohne klare Hierarchie
2. Admin-Funktionen und Member-Funktionen sind nicht getrennt

### 1. Sidebar-Struktur neu ordnen

Finde den Sidebar-Component. Strukturiere ihn in zwei klar getrennte Bereiche:

**Bereich 1 — "Mein Bereich"** (immer sichtbar für alle Rollen):
- Dashboard
- Aufgaben  
- Schichten
- Statistiken
- Mein Konto

**Bereich 2 — "Organisation verwalten"** (nur sichtbar wenn role === 'admin' | 'owner' | 'teamlead'):
- Mitglieder
- Teams
- Aufgaben verwalten
- Schichtplanung
- Ressourcen
- Finanzen
- Engagement
- Veranstaltungen

Füge zwischen den Bereichen einen visuellen Divider ein.
Der Admin-Bereich sollte mit einem kleinen "Admin"-Label oder Shield-Icon 
als geschützter Bereich erkennbar sein.

### 2. "Empfohlener Start"-Badge entfernen
Dieser Badge ist ein Onboarding-Workaround. Entferne ihn aus der Sidebar.
Stattdessen: Wenn ein User zum ersten Mal einloggt (kein `onboarding_completed`
Flag im Profil), zeige einen Willkommens-Banner auf dem Dashboard mit den
nächsten Schritten. Nach dem ersten Klick darauf: Flag setzen, Banner ausblenden.

### 3. Org-Name in der Sidebar optimieren
Der aktuelle Text "Abitur 2026 - Teletta-Groß-Gym..." wird abgeschnitten und wirkt
wie ein Fehler. 

Ersetze durch:
- Org-Logo (Initialen-Avatar) + Org-Name
- Name wird mit `truncate` abgeschnitten aber mit `title`-Attribut als Tooltip
- Kleiner Dropdown-Arrow falls Multi-Org-Wechsel geplant ist

```typescript
// Beispiel-Struktur für Org-Switcher in Sidebar:
<div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer">
  <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
    {org.name.substring(0, 2).toUpperCase()}
  </div>
  <span className="text-sm font-medium truncate" title={org.name}>{org.name}</span>
</div>
```
```

---

## PHASE 5 — Generalisierung (Abi → Alle Orgs)
*Das Produkt vom Einzelfall lösen.*

```
OrgFlow soll für alle Organisationen funktionieren, nicht nur für einen Abiturjahrgang.
Bitte behebe folgende Abhängigkeiten vom konkreten Anwendungsfall:

### 1. Team-Beispiele neutralisieren
In der Schichtplanung und Teams-Seite gibt es Placeholder-Texte wie:
- "z. B. Dekoration" → "z. B. Marketing, Technik, Aufbau"
- "z. B. Helferschicht, Infopoint" → "z. B. Einlass, Aufbau, Kasse"
- "z. B. Kantine, Halle" → bleibt gut, ist generisch genug

Durchsuche alle `placeholder`-Attribute und `z. B.`-Strings.
Ersetze Abi-spezifische Beispiele durch neutrale Alternativen.

### 2. Treasury-Excel-Import generalisieren
Die Seite "Finanzen" hat einen hartcodierten Excel-Zell-Identifier "M9".
Das ist jetzt schon konfigurierbar per UI — gut. 

Verbessere aber:
- Entferne den Default-Wert "M9" aus dem Code (er ist Abi-spezifisch)
- Ändere Default zu leerem Feld mit Placeholder "z. B. B5, M9"
- Füge einen Hilfe-Text hinzu: "Öffne deine Excel-Datei und gib die Zelladresse
  an, die den aktuellen Kontostand enthält."
- Die Env-Variable `TREASURY_EXCEL_CELL` kann als org-spezifischer Default bleiben,
  aber sollte pro Org in der DB gespeichert werden können (organizations-Tabelle:
  `treasury_excel_cell TEXT DEFAULT NULL`)

### 3. Mitglieder-Import: Titel anpassen
"Vorlage herunterladen" + Hinweis "Bestehende Namen werden übersprungen" ist gut.
Aber füge hinzu: Der Import-Button-Text "Upload" → "Importieren" (besser lokalisiert).

### 4. Fehler-Seiten generalisieren  
Suche nach hardcodierten Strings wie "TGG", "Abitur", "Abi" im gesamten 
components/- und app/-Verzeichnis.
Liste sie auf und ersetze jeden durch generische Alternativen.

Führe aus: grep -rn "TGG\|Abitur\|abi-2026\|abi2026\|TGG_ORG" app/ components/ lib/
```

---

## PHASE 6 — Dashboard-Verbesserungen
*Der erste Eindruck zählt.*

```
Das Dashboard ist die wichtigste Seite — verbessere sie grundlegend:

### 1. Begrüßung verbessern
Aktuell: "Hallo, Test User 2! 👋" mit Emoji im Titel.

Ersetze durch eine kontextbewusste Begrüßung:
```typescript
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 17) return 'Guten Tag';
  return 'Guten Abend';
}
// Ausgabe: "Guten Morgen, Leon" – ohne Emoji im Heading
```

### 2. "Was du jetzt tun kannst"-Box
Aktuell hat diese Box einen blauen Border-Left und Bullet-Points.
Das wirkt wie eine Debug-Info-Box.

Ersetze durch eine strukturierte "Heute"-Sektion mit Action-Cards:
- Jede offene Aktion (freie Schicht, offene Aufgabe) bekommt eine kleine Card
- Card hat Icon, Titel, CTA-Button
- Wenn nichts offen ist: "Alles erledigt – du bist auf dem neuesten Stand ✓"

### 3. Schichten-Liste: Duplikate verhindern
Aktuell erscheinen identisch benannte Schichten ("test", "test") mehrfach,
weil sie unterschiedliche Zeitslots haben. Das ist verwirrend.

Füge Zeitslot-Information prominenter ein:
- Format: "Test QA Shift — Mo 23.3., 09:00–11:00"
- Nicht: "Test QA Shift" + "23.3.2026, 01:00:00" darunter
- Datum/Zeit-Formatierung: nutze `Intl.DateTimeFormat` für lesbare Formate

Erstelle `lib/formatDate.ts`:
```typescript
export function formatShiftTime(start: string | Date, end: string | Date): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = new Intl.DateTimeFormat('de-DE', { 
    weekday: 'short', day: 'numeric', month: 'numeric' 
  }).format(s);
  const startTime = s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = e.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${startTime}–${endTime}`;
}
// Ausgabe: "Mo, 23.3., 09:00–11:00"
```

### 4. Engagement-Score-Card aufwerten
Aktuell: "Score: 8 | Platz: #1 von 1"

Das wirkt bedeutungslos bei wenig Mitgliedern.
Mache den Score motivierender:
- Zeige eine kleine Fortschrittsleiste zum nächsten Meilenstein
- "8 Punkte — nächster Meilenstein: 10 Punkte"
- Oder: Verstecke den Rang wenn < 3 Mitglieder aktiv sind
```

---

## PHASE 7 — Aufgaben-View polieren
*Die meistgenutzte Seite nach Dashboard.*

```
Die Aufgaben-Seite (Member-View) hat mehrere UX-Probleme:

### 1. Aufgaben-Card neu strukturieren
Aktuell: Titel + Meta-Info + zwei gleich gewichtete Buttons + Status rechts

Neue Struktur pro Aufgabe:
```
[Status-Badge]  Aufgaben-Titel                    [Primär-Button]
                Fällig: 27.3.2026 · In Arbeit     [Sekundär-Button]
```

- Status-Badge (StatusBadge-Komponente aus Phase 3) ganz links
- Titel prominent
- Fälligkeitsdatum: rot wenn überfällig, grau wenn noch Zeit
- Primärer Button: "Erledigen" (wenn in_arbeit) oder "Übernehmen" (wenn offen)
- Sekundärer Button nur: "Weitergeben" (statt "Zum Übernehmen anbieten" — zu lang)

### 2. "Übernommen von: Test User 2" entfernen oder umbenennen
Wenn der eingeloggte User die Aufgabe selbst hat, zeige:
"Von dir übernommen" statt "Übernommen von: Test User 2"

### 3. Aufgaben-Status-Farbe auch in der Zeile
Nutze einen farbigen linken Border je nach Status:
- In Arbeit: amber/gelb
- Überfällig: rot
- Erledigt: grün/grau (ausgeblendet / kollabiert)

```typescript
const STATUS_BORDER = {
  in_arbeit: 'border-l-4 border-l-amber-400',
  ueberfaellig: 'border-l-4 border-l-red-500',
  offen: 'border-l-4 border-l-gray-200',
  erledigt: 'border-l-4 border-l-green-400 opacity-60',
};
```

### 4. Erledigte Aufgaben ausblenden
Füge einen Toggle hinzu: "Erledigte anzeigen / ausblenden"
Default: ausgeblendet. Erledigte Aufgaben machen die Liste unübersichtlich.
```

---

## PHASE 8 — Finanzen/Treasury-Seite
*Professionellste UX nötig da sensitive Daten.*

```
Die Finanzen-Seite ist die unprofessionellste Seite in OrgFlow. Bitte:

### 1. Komplett auf Deutsch bringen
Alle englischen Strings ersetzen (Liste aus Phase 2 nutzen).
Breadcrumb und alle Seitentitel einheitlich "Finanzen".

### 2. Excel-Zell-Konfiguration verbessern
Aktuelles UI: Radio-Button "Excel (.xlsx)" + Datei-Upload + "Zelle mit Kassenstand (z. B. M9)"

Verbesserung:
- Die Zell-Konfiguration in einem Accordion oder Disclosure verstecken: 
  "Erweiterte Einstellungen" → aufklappen
- Default-Wert entfernen (kein "M9" vorbefüllt)
- Tooltip/Hilfe-Icon neben dem Feld mit Erklärung

### 3. Kassenstand-Anzeige prominenter
"Last balance: 1.292,32 € (14.3.2026, 17:44:53)"
→ Großer Metric-Card oben: "1.292,32 €" + "Letzter Stand: 14. März 2026"
   Die Uhrzeit kann weg — zu viel Detail auf dieser Ebene.

### 4. "Nur das Finanzteam..." Hinweis entfernen
Wenn die Rolle korrekt per RLS geprüft wird, braucht es diesen Text nicht.
Falls die Zugriffskontrolle per Rolle noch nicht 100% klappt, das als Bug
in Phase 1 behandeln — nicht per Hinweistext lösen.
```

---

## PHASE 9 — Mobile & Performance
*Letzter Schliff für echte Nutzbarkeit.*

```
OrgFlow muss auf Mobilgeräten funktionieren — Mitglieder tragen sich 
unterwegs in Schichten ein.

### 1. Mobile Navigation
Füge eine Bottom Navigation Bar für Mobile hinzu (< 768px):

```typescript
// components/layout/MobileNav.tsx
const NAV_ITEMS = [
  { href: '/dashboard', icon: HomeIcon, label: 'Start' },
  { href: '/schichten', icon: CalendarIcon, label: 'Schichten' },
  { href: '/aufgaben', icon: CheckSquareIcon, label: 'Aufgaben' },
  { href: '/statistiken', icon: BarChartIcon, label: 'Statistiken' },
];
```

- Sticky am unteren Rand
- 4 Hauptaktionen: Dashboard, Schichten, Aufgaben, Konto
- Aktiver State deutlich sichtbar
- Sidebar auf Mobile: als Drawer hinter Hamburger-Menü

### 2. PWA-Manifest hinzufügen
Erstelle `public/manifest.json`:
```json
{
  "name": "OrgFlow",
  "short_name": "OrgFlow",
  "description": "Organisation einfach gemacht",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#185FA5",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Füge in `app/layout.tsx` hinzu:
```typescript
export const metadata = {
  manifest: '/manifest.json',
  // ...
};
```

### 3. Datum/Zeit überall vereinheitlichen
Nutze `lib/formatDate.ts` (aus Phase 6) im gesamten Codebase.
Ersetze alle direkten `new Date().toLocaleString()` oder rohe ISO-Strings
mit den formatierten Varianten.

Suche: `grep -rn "toLocaleString\|toLocaleDateString\|01:00:00" app/ components/`

### 4. Loading States prüfen
Stelle sicher dass alle Datenbankabfragen einen Loading-State haben.
Pattern: Skeleton-Loading statt Spinner wo möglich, besonders für Listen.
```

---

## PHASE 10 — Cleanup & Code-Qualität
*Das Repo aufräumen.*

```
Abschließender Cleanup des Repos:

### 1. Root-Verzeichnis aufräumen
Verschiebe oder lösche folgende Dateien aus dem Root:
- `backup_2026-02-25.sql` → in `docs/` verschieben oder in .gitignore
- `cursor-phase1.md` → löschen (war ein Cursor-Artefakt)
- `VERCEL.md` → Inhalt in `docs/DEPLOYMENT.md` mergen, dann löschen
- `STATUS.md` → Inhalt prüfen, in README oder ROADMAP mergen

### 2. .gitignore erweitern
Füge zu `.gitignore` hinzu:
```
# Lokale Backup-Dateien
*.sql.bak
backup_*.sql

# Cursor/AI-Artefakte  
cursor-*.md
claude-*.md

# Lokale Credentials
docs/credentials-*.local.md
```

### 3. TypeScript-Fehler bereinigen
Führe `npm run build` aus und liste alle TypeScript-Fehler auf.
Behebe sie der Reihe nach, ohne `any`-Types einzuführen.

### 4. Console.log entfernen
`grep -rn "console.log" app/ components/ lib/ services/`
Ersetze Debug-Logs mit strukturiertem Logging oder entferne sie.

### 5. README aktualisieren
Das README erwähnt noch "OrgFlow für Schulen, Sportvereine..." korrekt,
aber der Abschnitt über TGG-Testaccounts und spezifische Routen muss raus.
Aktualisiere README so, dass es ein generisches Produkt beschreibt.
```

---

## Reihenfolge auf einen Blick

| Phase | Inhalt | Priorität | Dauer (ca.) |
|-------|--------|-----------|-------------|
| 1 | Kritische Bugs + Race Condition + Enum-Fix | 🔴 Sofort | 2–3h |
| 2 | i18n / Sprache vereinheitlichen | 🔴 Hoch | 1–2h |
| 3 | Design-System: Badges, Buttons, Komponenten | 🟡 Hoch | 3–4h |
| 4 | Navigation & Sidebar | 🟡 Hoch | 2h |
| 5 | Generalisierung (kein Abi-Fokus) | 🟡 Mittel | 1–2h |
| 6 | Dashboard polish | 🟢 Mittel | 2h |
| 7 | Aufgaben-UX | 🟢 Mittel | 1–2h |
| 8 | Finanzen-Seite | 🟢 Mittel | 1h |
| 9 | Mobile + PWA | 🟢 Später | 3–4h |
| 10 | Cleanup | 🟢 Später | 1h |

**Tipp:** Mache nach jeder Phase einen `git commit` mit aussagekräftigem Message.
So kannst du jederzeit zurückrollen falls Cursor etwas kaputt macht.