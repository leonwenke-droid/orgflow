export type AutoAssignPreviewBlocked = "already_assigned" | "cooldown" | "unavailable" | null;

export type AutoAssignPreviewRow = {
  user_id: string;
  full_name: string;
  score: number;
  blocked: AutoAssignPreviewBlocked;
};

export type PreviewAutoAssignForShiftResult =
  | { ok: true; needed: number; shiftId: string; rows: AutoAssignPreviewRow[] }
  | { ok: false; errorKey: string };

export type AssignAutoAssignForShiftResult =
  | { ok: true; assigned: number; members?: { user_id: string; full_name: string; score: number }[] }
  | { ok: false; errorKey: string };

