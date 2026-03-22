# OrgFlow – Review: Struktur, Lücken, empfohlene nächste Schritte

Stand: Analyse auf Basis des Repos (Next.js App Router, Supabase). Kein Live-Audit von <https://www.orgflow.de> durch automatisierte Logins.

## Architektur (Kurz)

| Bereich        | Implementierung |
|----------------|-----------------|
| Multi-Tenant   | `organization_id` auf Entitäten; Slug/Subdomain über `getCurrentOrganization` |
| TGG-Sonderfall | `getOrgIdForData` mappt Slugs `abi-2026-tgg` / `abi2026-tgg` auf feste UUID (`TGG_ORG_ID`) |
| Auth           | Supabase Auth, Cookies; **eine Session pro Browser** |
| Admin-UI       | Kanonisch `/admin/...?org=…`, Org-Admin-Routen oft Redirect |
| Schicht-Claim  | Server: `lib/claimShiftForMember.ts` (Service-Role + Prüfungen), nicht nur RPC |

## Bereits sinnvoll gelöst (kürzlich)

- Selbsteintragung Schichten ohne sofortige Auto-Füllung bei „Claim“-Modus (`app/admin/shifts/page.tsx`).
- Claim mit Profil-Match über erlaubte Org-IDs (TGG/Dual-ID) via `claimShiftForMember`.
- Ladezustände: `SubmitButtonWithSpinner`, `app/[org]/loading.tsx`, Modal/Plan.

## Hohe Priorität (Fehler / Risiken)

1. **Geheimnisse im Git**  
   `docs/MANUAL_QA_TGG.md` enthält Testpasswörter → bei **öffentlichem** Repo entfernen/rotieren oder nur gitignorierte `credentials-tgg.local.md` nutzen.

2. **Supabase-Migrationen Production**  
   Alle relevanten Migrationen (RLS, `claim_shift_slot`, `20260325000000_claim_rpcs_resolve_profile_by_org.sql`, Notifications, Consents, …) müssen mit Production synchron sein. Abweichung → scheinbar „zufällige“ Fehler.

3. **Service-Role vs. RPC**  
   Schicht-Claim läuft teils per Service-Role im App-Code, DB-RPC existiert weiter. **Dokumentieren**, welcher Weg „Source of Truth“ ist; langfristig eine Variante reduzieren, um Regeln nicht doppelt zu pflegen.

4. **Super-Admin ohne Profil in Org**  
   Dashboard-Logik erlaubt Super-Admin; `myProfileId` kann fehlen → Claim-Buttons u. a. ausgeblendet. Explizite UX: „Als Org-Mitglied testen“ oder Hinweis.

## Mittlere Priorität (UX / Konsistenz)

5. **Fehlermeldungen**  
   `claimShift=error` ist generisch; optional Codes (`not_member`, `full`, …) in Query + i18n-Texte.

6. **Anzeige „x/y Plätze frei“**  
   Nutzer verwechseln `0/4` (0 frei) mit „4 frei“. Klarere Copy (z. B. „**0 von 4** frei“) in DE/EN.

7. **Hardcodierte englische Strings**  
   z. B. Admin Members: „Download pending invites“, „Excel import“ – in `lib/i18n.ts` auslagern.

8. **`TaskConfirmationForm` (Magic-Link)**  
   Teilweise englische UI – auf Locale/i18n angleichen oder auf Modal-Flow verweisen.

9. **Schichtplan „Sign up“**  
   War lokalisiert; prüfen, ob alle Plan-Komponenten gleiche Sprache nutzen.

## Tests & Qualität

10. **E2E-Tests fehlen** für kritische Pfade: Admin legt Schicht (claim) an → Member trägt sich ein → Aufgabe claim + complete.

11. **Load/Stress**  
   Gleichzeitiges Claim letzter Slot: Race; ggf. DB-Constraint oder transaktionale Absicherung prüfen.

## Produkt / später

12. **Impersonation** (nur Super-Admin) zum Support, ohne echte Passwörter zu teilen.  
13. **Rate-Limiting** API-Routen (Invite, Claim, Export).  
14. **Audit-Log** für alle sicherheitsrelevanten Aktionen vereinheitlichen.  
15. **Mobile Navigation** / PWA-Überlegungen für Schichten unterwegs.  
16. **Stripe/Billing** (falls aktiv): End-to-End mit Testkarten und Plan-Wechsel verifizieren.

## Manuelles QA

Siehe **`docs/MANUAL_QA_TGG.md`** (Zwei-Browser-Setup + Checkliste).
