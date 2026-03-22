# Manuelles QA: Admin ↔ Member (abi-2026-tgg)

> **Sicherheit:** **Keine Passwörter in Git.** Lege lokal `docs/credentials-tgg.local.md` an (siehe `.gitignore`) – Vorlage: [`credentials-tgg.local.example.md`](./credentials-tgg.local.example.md).

## Ziel-URL (Production)

- Dashboard: <https://www.orgflow.de/abi-2026-tgg/dashboard>
- Admin-Schichten (kanonisch): <https://www.orgflow.de/admin/shifts?org=abi-2026-tgg>  
  (Redirect von `/abi-2026-tgg/admin/shifts`)

## Warum zwei Browser / zwei Profile?

Supabase-Auth nutzt **ein Session-Cookie pro Browser**. Mit **demselben Tab** kannst du nicht gleichzeitig Admin und Member testen.

**Empfehlung:**

| Rolle   | Umgebung                                      |
|--------|------------------------------------------------|
| Admin  | z. B. Chrome (normales Profil)                 |
| Member | Firefox **oder** Chrome-InPrivate **oder** zweites Chrome-Profil |

So bleiben die Sessions getrennt.

## Testkonten (Staging / manuelles QA)

E-Mail und Passwort für Admin/Member stehen **nur lokal** in `docs/credentials-tgg.local.md` (nicht versioniert). Struktur siehe `docs/credentials-tgg.local.example.md`.

## Checkliste: typische Admin → Member Abläufe

1. **Admin (Browser A)**  
   - Einloggen → Admin-Schichten öffnen (`/admin/shifts?org=abi-2026-tgg`).  
   - Neue Schicht anlegen: **„Mitglieder tragen sich selbst ein“** (nicht Auto-Zuteilung), `required_slots` ≥ 1.  
   - Optional: Aufgabe anlegen, **übernehmbar**, ohne feste Person.

2. **Member (Browser B)**  
   - Einloggen → `…/abi-2026-tgg/dashboard`.  
   - Unter **„Kommende Schichten (7 Tage)“** auf **Eintragen** klicken (Spinner/Ladezustand prüfen).  
   - `…/abi-2026-tgg/shifts`: Schicht erscheint mit Badge **„Du bist eingetragen“** (wenn zutreffend).

3. **Admin (Browser A)**  
   - Schichtplan / Admin-Ansicht: Zuweisung sichtbar.

4. **Optional Tausch**  
   - Member: Schicht **zum Tausch anbieten**.  
   - Zweiter Member (drittes Profil/Browser): **Übernehmen** beim Tauschangebot.

5. **Aufgaben**  
   - Member: `…/tasks` → übernehmbare Aufgabe **Übernehmen**; eigene Aufgabe **Bearbeiten / erledigen** (Modal).

## Wenn etwas fehlschlägt

- Roter Banner nach Schicht-Claim: Query `?claimShift=error` – Server-Logs prüfen (`claimShiftFromDashboard` / `claimShiftForMember`).  
- Supabase: Migrationen insbesondere `claim_rpcs_resolve_profile_by_org` und RLS für `shift_assignments` müssen auf **Production** angewendet sein (siehe `docs/DEPLOYMENT.md`).  
- TGG: Daten liegen teils unter fester Org-UUID vs. `organizations.id` – die App gleicht das in `getOrgIdForData` / `claimShiftForMember` ab; inkonsistente **manuelle** DB-Einträge können trotzdem Probleme machen.
