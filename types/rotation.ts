/** Fair rotation preview / assign (see `rotation_preview` / `rotation_assign` RPCs). */

/** `rotation_scores` row (profile id = `user_id`). */
export type RotationScore = {
  user_id: string;
  organization_id: string;
  score: number;
  total_shifts_done: number;
  last_assigned_at: string | null;
  last_shift_at: string | null;
};

/** `member_unavailability` row. */
export type MemberUnavailability = {
  user_id: string;
  organization_id: string;
  unavailable_from: string;
  unavailable_until: string;
  reason: string | null;
};

export type RotationPreviewBlocked = "already_assigned" | "unavailable" | null;

export type RotationPreviewRow = {
  user_id: string;
  full_name: string;
  /** Engagement score (`engagement_scores.score`; can be negative). Fair ordering uses this, not rotation_scores. */
  score: number;
  last_assigned_at: string | null;
  last_shift_at: string | null;
  will_assign: boolean;
  blocked: RotationPreviewBlocked;
};

/** Successful `rotation_preview` payload. */
export type RotationPreview = {
  needed: number;
  shiftId: string;
  rows: RotationPreviewRow[];
};

export type PreviewRotationForShiftResult =
  | { ok: true; needed: number; shiftId: string; rows: RotationPreviewRow[] }
  | { ok: false; errorKey: string };

export type AssignRotationFairOneResult =
  | { ok: true; assigned: number }
  | { ok: false; errorKey: string };
