# Deployment auf Vercel

Damit der Build durchläuft und die App funktioniert, müssen in Vercel **Environment Variables** gesetzt werden:

1. Im Vercel-Dashboard: **Project → Settings → Environment Variables**
2. Folgende Variablen anlegen (Werte aus dem Supabase-Dashboard unter **Project Settings → API**):

| Name | Beschreibung |
|------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role Key (geheim halten) |

3. Für **Production**, **Preview** und **Development** aktivieren, damit sie beim Build und zur Laufzeit verfügbar sind.

4. **Wichtig:** Nach dem Hinzufügen oder Ändern der Variablen ein **neues Deployment** auslösen (Deployments → … → Redeploy). Die `NEXT_PUBLIC_*`-Variablen werden zur Build-Zeit eingebettet – ohne Redeploy nutzt die laufende App weiterhin die alten (leeren) Werte.

Ohne diese Variablen schlägt der Build mit einem Fehler zu fehlenden Supabase-Credentials fehl.

**Einladungs-Links (Leads):** Für E-Mail-Einladungen an Komiteeleitungen muss `NEXT_PUBLIC_APP_URL` (oder `NEXT_PUBLIC_SITE_URL`) auf die Basis-URL der App gesetzt sein (z. B. `https://abi-orga.vercel.app`). In Supabase unter **Authentication → URL Configuration** die Redirect-URL eintragen: `https://deine-domain.de/auth/callback`.

**Supabase Auth für Produktion:** Damit Login in der Deployment-Umgebung funktioniert, in Supabase unter **Authentication → URL Configuration** eintragen:
- **Site URL:** `https://deine-app.vercel.app` (oder deine Custom-Domain)
- **Redirect URLs:** `https://deine-app.vercel.app/**` und `https://deine-app.vercel.app/auth/callback`

Ohne diese Einträge können Sessions/Cookies in Produktion fehlschlagen.

**E-Mail-Verifikation (Registrierung):** Die Bestätigungs-E-Mail wird über einen n8n-Webhook versendet. In Vercel optional `N8N_WEBHOOK_URL_SEND_MAGIC_LINK` setzen (Standard: `https://n8n.srv881499.hstgr.cloud/webhook/send-magic-link`). Der Webhook erhält per POST JSON: `email`, `confirmLink`, `fullName`, `type: "signup"`. n8n sendet die E-Mail mit dem Link; der Nutzer klickt darauf, wird von Supabase bestätigt und zur App weitergeleitet.

**E-Mail-Limit:** Supabase begrenzt die Anzahl versendeter E-Mails (Einladungen, Magic Links) pro Stunde. Bei „email rate limit exceeded“ einige Minuten warten und erneut versuchen. Höhere Limits gibt es in Supabase unter **Project Settings → Auth** bzw. mit einem anderen Plan.
