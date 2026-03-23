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

### App URL and auth redirects

- Set `NEXT_PUBLIC_APP_URL` (or `NEXT_PUBLIC_SITE_URL`) to your app’s base URL (e.g. `https://your-app.vercel.app`).
- In Supabase **Authentication → URL Configuration**:
  - **Site URL:** your production origin
  - **Redirect URLs:** include `https://your-domain/**` and `https://your-domain/auth/callback`

Without this, sessions and magic links can fail in production.

### Optional: email / magic link webhook

Registration confirmation can use an n8n (or similar) webhook. In Vercel, optionally set `N8N_WEBHOOK_URL_SEND_MAGIC_LINK`. The endpoint receives JSON: `email`, `confirmLink`, `fullName`, `type: "signup"`.

### Email rate limits

Supabase limits auth emails per hour. If you see rate-limit errors, wait and retry or adjust plan/settings in Supabase.

## Vercel: Production branch and deploys

1. **Git → Production Branch** — Point to your production branch (often **`main`**).
2. **Latest Production deployment** — After merges, confirm Production shows the latest commit; **Redeploy** if needed.
3. **Build-time env** — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are baked in at build; change them only with a new deployment.

## Supabase: migrations on the production project

Apply migrations to the **same** Supabase project as your production env vars. Examples of areas covered by migrations:

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
