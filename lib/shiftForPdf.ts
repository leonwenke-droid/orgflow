/**
 * Serializable shift shape for PDF exports, stats, and calendar UIs.
 */
export type ShiftForPdf = {
  id: string;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  has_aufbau?: boolean;
  has_abbau?: boolean;
  required_slots?: number | null;
  auto_assign?: boolean | null;
  claimable?: boolean | null;
  assignment_kind?: string | null;
  attendance_mode?: string | null;
  event_id?: string | null;
  qr_token?: string | null;
  qr_valid_from?: string | null;
  qr_valid_until?: string | null;
  shift_assignments?: {
    id: string;
    status: string;
    user_id: string;
    replacement_user_id?: string | null;
    checked_in_at?: string | null;
    check_in_method?: string | null;
    /** Spec: registered | present | absent | excused */
    attendance_status?: string | null;
  }[];
};
