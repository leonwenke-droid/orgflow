# Rollback runbook (Vercel + Supabase)

This project is designed to support **fast, safe rollbacks**.

## Vercel app rollback

- Go to **Vercel → Project → Deployments**
- Pick the last known-good deployment
- Use **“Redeploy”** (or promote it, depending on your UI)
- Verify:
  - `GET /api/health` returns `200` with `{ ok: true }`
  - Login flow works
  - Core org pages load (overview, tasks, shifts)

## Database migrations policy (Supabase)

We follow **additive migrations only** by default:

- ✅ Add columns (nullable or with defaults)
- ✅ Add new tables
- ✅ Add indexes
- ✅ Add new RLS policies / functions
- ❌ Avoid dropping columns/tables in release migrations
- ❌ Avoid changing column types in-place

This keeps rollbacks feasible: the old app keeps working against the newer schema.

## If a DB change caused the incident

Preferred: ship a **forward-fix migration** (still additive) and redeploy.

If you must undo an index or function:

- Create a new migration that does the opposite (example: `drop index if exists ...;`)
- Apply it in Supabase
- Redeploy the last known-good Vercel build (or the forward-fix build, if that resolves it)

## Operational notes

- Supabase Auth reset-link TTL is configured in Supabase Auth settings.
- Logs:
  - App errors → Vercel logs
  - DB/auth events → Supabase logs

