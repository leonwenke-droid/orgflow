/**
 * Invite link generation and validation
 */

import { randomBytes } from "crypto";

const INVITE_TOKEN_BYTES = 32;

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("hex");
}

export function buildInviteUrl(baseUrl: string, orgSlug: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/join/${orgSlug}?token=${encodeURIComponent(token)}`;
}
