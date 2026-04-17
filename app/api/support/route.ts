import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../lib/rateLimit";
import { asTrimmedString, isValidEmail, readJson } from "../../../lib/validation";
import { getClientIp } from "../../../lib/log";
import { sendSupportRequest } from "../../../lib/n8n";

export const runtime = "nodejs";

const VALID_TYPES = ["support", "bug", "idea", "delete", "question"] as const;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`support:${ip}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Zu viele Anfragen. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const parsed = await readJson<{
    email?: unknown;
    name?: unknown;
    type?: unknown;
    subject?: unknown;
    message?: unknown;
  }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ message: "Ungültige Anfrage." }, { status: 400 });
  }

  const email = asTrimmedString(parsed.data.email)?.toLowerCase() ?? "";
  const name = asTrimmedString(parsed.data.name) || undefined;
  const type = asTrimmedString(parsed.data.type) || "support";
  const subject = asTrimmedString(parsed.data.subject) || undefined;
  const message = asTrimmedString(parsed.data.message) ?? "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ message: "Gültige E-Mail-Adresse erforderlich." }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ message: "Nachricht zu kurz." }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ message: "Ungültiger Typ." }, { status: 400 });
  }

  await sendSupportRequest({
    email,
    name,
    type: type as (typeof VALID_TYPES)[number],
    subject,
    message
  }).catch((err) => console.error("[support] n8n failed:", err));

  return NextResponse.json({ ok: true });
}
