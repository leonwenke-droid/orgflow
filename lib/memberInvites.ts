import { createHash, randomBytes } from "crypto";

export const MEMBER_INVITE_DAYS = 14;

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildInviteUrl(baseUrl: string, token: string): string {
  const base = String(baseUrl || "").trim().replace(/\/$/, "");
  return `${base}/invite/${encodeURIComponent(token)}`;
}

export function buildWhatsAppInviteText(params: {
  firstName?: string | null;
  organizationName: string;
  inviteUrl: string;
}): string {
  const firstName = String(params.firstName ?? "").trim();
  const greeting = firstName ? `Moin ${firstName},` : "Moin,";
  return [
    greeting,
    `hier ist dein Zugang zu OrgFlow für ${params.organizationName}:`,
    params.inviteUrl,
    "Darüber kannst du dein Passwort setzen und danach deine Aufgaben und Schichten einsehen."
  ].join("\n");
}

export function inviteExpiresAt(days = MEMBER_INVITE_DAYS): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}
