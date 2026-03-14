# OrgFlow — Roadmap

## Umgesetzt (Stand: Roadmap-Abarbeitung)

- **Event-Entity:** Tabelle `events`, `event_id` in shifts/tasks, Seite `/[org]/admin/events` mit Anlegen und Liste.
- **Shift-Features:** Self-Signup („Sign up“) für freie Schichten im Dashboard; Auto-Assignment war bereits vorhanden. **Reminder:** noch offen (E-Mail-Provider anbinden).
- **SaaS-UX:** Leere Zustände mit `EmptyState` und i18n (empty.*, cta.*); Onboarding-Banner mit Dismiss auf dem Dashboard.
- **Sicherheit:** Passwort-Reset („Forgot password?“ + `/auth/forgot-password` + API); Hinweisbanner bei nicht verifizierter E-Mail (`EmailVerificationBanner`). Rate Limiting weiterhin offen.
- **Branding:** Typografie und Abstände in `globals.css` (Variablen, h1–h3), Antialiasing.

---

## Noch offen

- **Reminder:** E-Mail/Push-Erinnerungen vor Schichtbeginn (z. B. Resend, Supabase Edge, Cron).
- **Rate Limiting:** API/Login begrenzen (z. B. Vercel/Upstash oder Middleware).
- **E-Mail-Verifizierung erzwingen:** Supabase Dashboard „Confirm email“ + ggf. App-seitige Einschränkung für unbestätigte User.
- **Events vertiefen:** Shifts/Tasks beim Anlegen optional einem Event zuordnen; Filter in Shifts/Tasks nach Event.
