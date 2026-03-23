# Undo / Restore Concept for Tasks and Shifts

This document defines a low-risk path to introduce recoverability for deleted tasks and shifts.

## Goal

- Prevent irreversible data loss from accidental deletes.
- Keep existing UI flows mostly unchanged.
- Stay compatible with role-based access and organization scoping.

## Proposed Model: Soft Delete + Trash Views

Use soft-delete markers instead of hard delete:

- `deleted_at timestamptz null`
- `deleted_by uuid null` (profile id)

Apply to:

- `tasks`
- `shifts`

Hard delete is only allowed by explicit maintenance jobs or super-admin tools.

## RLS and Access

- Default list queries must filter `deleted_at is null`.
- Trash views query only `deleted_at is not null`.
- Restore action allowed for org admins/leads/owners in same organization.
- `deleted_by` is set on delete action and remains immutable after restore for audit trace.

## API/Action Surface

- Replace current delete operations with:
  - `softDeleteTask(taskId, actorProfileId)`
  - `softDeleteShift(shiftId, actorProfileId)`
- Add restore actions:
  - `restoreTask(taskId)`
  - `restoreShift(shiftId)`

All actions must enforce organization scope and admin-like role checks.

## UI Changes (Phase D/E implementation target)

- Add `Trash` tabs on admin task/shift pages.
- Show deletion timestamp and deleted-by info if available.
- Add `Restore` button with confirmation.
- Keep existing active lists unchanged.

## Migration Plan

1. Schema migration:
   - add `deleted_at`, `deleted_by` columns to `tasks` and `shifts`
   - add indexes:
     - `(organization_id, deleted_at)`
2. Update delete actions to soft-delete.
3. Update read queries to exclude deleted rows by default.
4. Add trash queries/views + restore actions.
5. Add retention policy job (optional): hard-delete rows older than X days.

## Backward Compatibility and Risk

- Existing UI keeps working after query filters are added.
- No immediate destructive migration needed.
- Rollback is simple: ignore new columns and restore old delete actions.

## Acceptance Criteria

- Deleting a task/shift removes it from active list without permanent loss.
- Deleted item appears in trash with metadata.
- Restore returns it to active list with prior data intact.
- Non-admin users cannot view or restore trash items.
