-- Allow org members to claim free shift slots via RLS (no service role)

-- Member can insert their own assignment for shifts in their org.
drop policy if exists "shift_assignments_member_claim" on public.shift_assignments;
create policy "shift_assignments_member_claim"
  on public.shift_assignments for insert
  with check (
    user_id = public.current_profile_id()
    and exists (
      select 1
      from public.shifts s
      where s.id = shift_assignments.shift_id
        and (
          public.is_super_admin()
          or s.organization_id = public.current_user_organization_id()
        )
    )
  );

-- Allow member to delete their own assignment if needed (optional)
drop policy if exists "shift_assignments_member_unclaim" on public.shift_assignments;
create policy "shift_assignments_member_unclaim"
  on public.shift_assignments for delete
  using (
    user_id = public.current_profile_id()
  );

