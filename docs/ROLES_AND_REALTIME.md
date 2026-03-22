# Roles roadmap & optional realtime

## Granular roles

OrgFlow today maps database roles in `lib/permissions.ts` (`ADMIN_ROLES`, `FINANCE_ROLES`, etc.).  
A roadmap for **capability flags** (e.g. per-module edit) is to store them in `organizations.settings` and centralise checks in `lib/permissions.ts`, then enable module-by-module.

## Realtime

**Optional:** Supabase Realtime subscriptions on `shift_assignments` or `tasks` can refresh admin views without manual reload.  
Until then, **in-app notifications** + **`router.refresh()`** after member actions keep data sufficiently current.
