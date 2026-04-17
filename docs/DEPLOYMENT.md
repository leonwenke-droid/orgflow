# Production deployment checklist (OrgFlow)

Use this checklist so your production host matches the repo and database expectations.

## Vercel: environment variables

The app **requires** Supabase credentials. Set them in **Project → Settings → Environment Variables**:

| Name | Description |
|------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, keep secret) |

1. Enable these for **Production**, **Preview**, and **Development** so they are available at build and runtime.
2. **Important:** After adding or changing variables, trigger a **new deployment** (Deployments → … → Redeploy). `NEXT_PUBLIC_*` values are embedded at **build** time; without redeploy, the app may still use old or empty values.
3. Without these variables, the build fails with missing Supabase configuration.

**Edge middleware:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present at **build** time for the environment you deploy (Production / Preview). If they are missing in the bundle, protected routes can return **503** and Vercel logs show `[middleware] Missing NEXT_PUBLIC_SUPABASE_…`.

### App URL and auth redirects

- Set `NEXT_PUBLIC_APP_URL` (or `NEXT_PUBLIC_SITE_URL`) to your app’s base URL (e.g. `https://your-app.vercel.app`).
- In Supabase **Authentication → URL Configuration**:
  - **Site URL:** your production origin
  - **Redirect URLs:** include `https://your-domain/**` and `https://your-domain/auth/callback`

Without this, sessions and magic links can fail in production.

### Optional: email / magic link webhook

Registration confirmation can use an n8n (or similar) webhook. In Vercel, optionally set `N8N_WEBHOOK_URL_SEND_MAGIC_LINK`. If unset, signup still succeeds but no confirmation email is sent via n8n (you should rely on another channel or configure the webhook). The endpoint receives JSON: `email`, `confirmLink`, `fullName`, `type: "signup"`.

### Email rate limits

Supabase limits auth emails per hour. If you see rate-limit errors, wait and retry or adjust plan/settings in Supabase.

## Vercel: Production branch and deploys

1. **Git → Production Branch** — Point to your production branch (often **`main`**).
2. **Latest Production deployment** — After merges, confirm Production shows the latest commit; **Redeploy** if needed.
3. **Build-time env** — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are baked in at build; change them only with a new deployment.

## Supabase: migrations on the production project

Apply migrations to the **same** Supabase project as your production env vars. If the app shows errors like **`column ... deleted_at does not exist`** on admin tasks/shifts, apply the soft-delete migration (e.g. `20260326010000_tasks_shifts_soft_delete.sql` in the repo) via `npm run db:push` or the SQL Editor.

Examples of areas covered by migrations:

| Area | Examples (file names may vary) |
|------|--------------------------------|
| Org admin RPC | `is_org_admin`–style RPCs |
| Shift claim | RLS + `claim_shift_slot` (or equivalent atomic claim) |
| Claimable tasks/shifts | Task/shift claim flags and related RPCs |
| Org routing | `slug_aliases` on `organizations` for legacy slugs |
| Member feedback / notifications | Feature requests + in-app notifications |

**How to verify**

- In **SQL Editor**, confirm critical functions exist, e.g. `claim_shift_slot` if your app uses it:
  `select proname from pg_proc where proname = 'claim_shift_slot';`
- After deploy, test member sign-up / shift claim; missing RPCs often surface as 500s from the API.

## Smoke test after deploy

1. **Admin:** `/admin/tasks?org=<your-slug>` — create a task; payload should include `organization_id` when the page resolved an org.
2. **Admin:** `/admin/shifts?org=<your-slug>` — create a shift; payload should include `organization_id` when applicable.
3. **Member:** `/<slug>/tasks` and `/<slug>/shifts` — data appears for that organisation’s `organization_id` (including any slug-alias mapping you configured).

## Local database backups

Large SQL dumps and `backup_*.sql` files are gitignored; keep them under `docs/` or another non-committed location if you need them locally.

## Rate limiting (Upstash Redis)

Production builds **require** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (see `.env.example`). Without Upstash, limits fall back to in-memory storage and are **not effective** across Vercel serverless instances.

## Cron jobs (`CRON_SECRET`)

Endpoints:

- `GET /api/cron/shift-reminders`
- `GET /api/cron/rotation-decay`
- `GET /api/cron/process-deletions` (DSGVO: processes `deletion_requests` pending **> 30 days**)

Each endpoint returns **500** if `CRON_SECRET` is unset, and **401** if the header is wrong.

**Authorization:** Set `CRON_SECRET` in the Vercel project; scheduled invocations send `Authorization: Bearer <CRON_SECRET>` (see [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). If you call the URLs manually or from an external scheduler, send the same header.

Reminder endpoints (`shift-reminders`, `task-reminders`) use a **~2h window around “24h before”**; `vercel.json` runs them **hourly** (`0 * * * *`) so that window can be hit. A **once-daily** cron would miss most shifts/tasks.

Suggested schedules (UTC), matching `vercel.json` as a reference:

- Shift / task reminders: `0 * * * *` (hourly)
- Rotation decay: `0 2 * * *`
- Deletion processing: `0 3 * * *` (DSGVO)

## DSGVO-Lösch-Cron

`/api/cron/process-deletions` anonymisiert betroffene `profiles` (Status `disabled`, personenbezogene Felder entfernt). Gibt es **keine weiteren aktiven** Mitgliedschaften für dieselbe `auth_user_id`, wird der Supabase-Auth-User per `auth.admin.deleteUser` entfernt. Anschließend wird der `deletion_requests`-Eintrag auf `completed` gesetzt.

## DSGVO-Checkliste vor Launch

- [ ] AVV mit Supabase abschließen: [supabase.com/dpa](https://supabase.com/dpa)
- [ ] AVV mit Vercel abschließen: [vercel.com/legal/dpa](https://vercel.com/legal/dpa)
- [ ] Impressum vollständig (Name, Adresse, E-Mail, Verantwortliche Person)
- [ ] Datenschutzerklärung aktuell (Stripe, Supabase, Vercel, Resend, N8N namentlich)
- [ ] DSGVO-Lösch-Cron eingerichtet (`/api/cron/process-deletions`, z. B. täglich 03:00 UTC) **mit** `Authorization: Bearer CRON_SECRET`
- [ ] Cookie-Banner: Opt-In vor Tracking-Cookies sichergestellt

## Production environment validation

`instrumentation.ts` calls `validateProductionEnv()` when `NODE_ENV === "production"`. **Hard failure** only if core vars are missing (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`). **Stripe** (`STRIPE_WEBHOOK_SECRET`, price IDs), **Upstash**, and **CRON_SECRET** log **warnings** if unset so the app still boots; set them before relying on billing, webhooks, rate limits, or crons.

## Sentry (optional)

Set `NEXT_PUBLIC_SENTRY_DSN` in production to enable error reporting. Without a DSN, Sentry stays disabled.

## Security headers

- **HSTS** is sent only when `NODE_ENV === "production"`.
- **CSP** is enforced in production by default unless `CSP_ENFORCE=0` (Report-Only for debugging).
