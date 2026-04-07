import { randomBytes } from "crypto";

/** Cryptographically secure token (12 chars, base64url subset) for shift QR. */
export function generateShiftQrToken(): string {
  return randomBytes(8).toString("base64url").substring(0, 12);
}

function parseLocalDateTime(dateYmd: string, hhmm: string): Date {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/** ±1h window around slot (Spec: 1h before start until 1h after end). */
export function shiftQrValidityIso(dateYmd: string, startTime: string, endTime: string): {
  qr_valid_from: string;
  qr_valid_until: string;
} {
  const start = parseLocalDateTime(dateYmd, startTime);
  const end = parseLocalDateTime(dateYmd, endTime);
  const from = new Date(start.getTime() - 60 * 60 * 1000);
  const until = new Date(end.getTime() + 60 * 60 * 1000);
  return { qr_valid_from: from.toISOString(), qr_valid_until: until.toISOString() };
}

export function qrFieldsForAttendanceMode(
  attendanceMode: string,
  dateYmd: string,
  startTime: string,
  endTime: string
): { qr_token: string | null; qr_valid_from: string | null; qr_valid_until: string | null } {
  if (attendanceMode !== "qr") {
    return { qr_token: null, qr_valid_from: null, qr_valid_until: null };
  }
  const token = generateShiftQrToken();
  const { qr_valid_from, qr_valid_until } = shiftQrValidityIso(dateYmd, startTime, endTime);
  return { qr_token: token, qr_valid_from, qr_valid_until };
}

export function isShiftQrWindowActive(
  qrValidFrom: string | null | undefined,
  qrValidUntil: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!qrValidFrom || !qrValidUntil) return false;
  const a = new Date(qrValidFrom).getTime();
  const b = new Date(qrValidUntil).getTime();
  const t = now.getTime();
  return t >= a && t <= b;
}
