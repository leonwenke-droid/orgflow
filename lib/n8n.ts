/**
 * Zentraler n8n-Webhook-Client.
 * Alle ausgehenden E-Mails laufen über diese Funktionen.
 */

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET ?? "";

async function callWebhook(url: string | undefined, body: Record<string, unknown>): Promise<void> {
  if (!url) {
    console.warn(`[n8n] Webhook URL not configured — skipping email`);
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: WEBHOOK_SECRET, ...body })
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`n8n webhook failed (${res.status}): ${msg}`);
  }
}

/** E-Mail-Bestätigung nach Registrierung */
export async function sendSignupConfirmation(params: {
  email: string;
  magicLink: string;
  fullName?: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK, {
    type: "signup",
    email: params.email,
    magicLink: params.magicLink,
    fullName: params.fullName ?? null
  });
}

/** Passwort-Reset-Link */
export async function sendPasswordReset(params: {
  email: string;
  resetLink: string;
  fullName?: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_PASSWORD_RESET, {
    email: params.email,
    resetLink: params.resetLink,
    fullName: params.fullName ?? null
  });
}

/** Mitglied-Einladung (einzeln oder bulk) */
export async function sendMemberInvite(params: {
  email: string;
  inviteUrl: string;
  organizationName: string;
  inviterName?: string;
  role?: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_INVITE, {
    email: params.email,
    confirmLink: params.inviteUrl,
    organizationName: params.organizationName,
    inviterName: params.inviterName ?? null,
    role: params.role ?? "Mitglied"
  });
}

/** Schicht-Erinnerung (Cron) */
export async function sendShiftReminder(params: {
  email: string;
  fullName?: string;
  eventName: string;
  date: string;
  startTime?: string;
  orgName: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_SHIFT_REMINDER, {
    email: params.email,
    fullName: params.fullName ?? null,
    eventName: params.eventName,
    date: params.date,
    startTime: params.startTime ?? null,
    orgName: params.orgName
  });
}

