# Production deployment checklist (OrgFlow)

Use this checklist so **orgflow.de** (or any production host) matches the repo and database expectations from the demo checklist.

## Vercel: Production branch and deploys

1. **Git → Production Branch**  
   In the Vercel project: **Settings → Git → Production Branch** should point to the branch you treat as production (recommended: **`main`**).

2. **Latest commit on Production**  
   After merging fixes, confirm the **Production** deployment in the Vercel dashboard is the latest commit (not only Preview). Trigger **Redeploy** if needed.

3. **Environment variables**  
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are baked in at **build** time. After changing them, run a **new Production deployment**.

4. **Server-only secrets**  
   Ensure `SUPABASE_SERVICE_ROLE_KEY` (and any other server secrets) are set for the **Production** environment in Vercel.

## Supabase: migrations on the production project

Apply migrations to the **same** Supabase project referenced by production env vars. The app expects (among others):

| Area | Migration files (examples) |
|------|---------------------------|
| Org admin RPC | `20260230700000_is_org_admin_rpc.sql`, `20260314000000_is_org_admin_owner.sql` |
| Shift claim (self sign-up) | `20260321001000_shift_assignments_member_claim_rls.sql`, `20260321002000_claim_shift_rpc.sql` (`claim_shift_slot`) |
| Claimable tasks/shifts + RPC updates | `20260324003000_tasks_shifts_claimable_and_claim_task_rpc.sql` |
| Legacy org / TGG data id | `20260231100000_ensure_tgg_org_id_slug.sql`, `20260324002000_current_user_org_legacy_mapping.sql` |
| Member feedback + in-app notifications | `20260325006000_feature_requests_member_access.sql`, `20260325007000_user_notifications.sql` |

**How to verify**

- In Supabase **SQL Editor**, confirm the function exists:  
  `select proname from pg_proc where proname = 'claim_shift_slot';`
- After deploy, test member **Sign up** on a claimable shift; if the RPC is missing, the API returns 500.

## Smoke test after deploy

1. Admin: open `/admin/tasks?org=<your-slug>` — **New task** should appear; created tasks should use the org scope (see app fix: hidden `organization_id` on the new-task form).
2. Admin: open `/admin/shifts?org=<your-slug>` — create a shift; request payload should include `organization_id` when the page resolved an org.
3. Member: open `/<slug>/tasks` and `/<slug>/shifts` — data appears when rows exist for that org’s `organization_id` (including TGG legacy mapping for `abi-2026-tgg` / `abi2026-tgg`).
