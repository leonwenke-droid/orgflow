-- Allow org admins to update shift assignments (e.g., check-in)

drop policy if exists "shift_assignments_update_admin" on public.shift_assignments;
create policy "shift_assignments_update_admin"
on public.shift_assignments
for update
using (
  public.is_super_admin()
  or current_profile_role() in ('admin', 'lead', 'owner', 'super_admin')
);

