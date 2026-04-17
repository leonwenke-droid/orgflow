/**
 * Zentraler n8n-Webhook-Client.
 * Alle ausgehenden E-Mails laufen über diese Funktionen.
 */

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET ?? "";
const WEBHOOK_AUTH_HEADER = (process.env.N8N_WEBHOOK_AUTHORIZATION ?? "").trim();
const HAS_WEBHOOK_AUTH = !!WEBHOOK_SECRET || !!WEBHOOK_AUTH_HEADER;

async function callWebhook(url: string | undefined, body: Record<string, unknown>, label: string): Promise<void> {
  if (!url) {
    console.warn(`[n8n] ${label}: Webhook URL not configured — skipping`);
    return;
  }
  // Either a shared secret (in body) OR an Authorization header can secure the webhook.
  if (!WEBHOOK_SECRET && !WEBHOOK_AUTH_HEADER) {
    console.warn(
      `[n8n] ${label}: neither N8N_WEBHOOK_SECRET nor N8N_WEBHOOK_AUTHORIZATION configured — skipping`
    );
    return;
  }
  const payload = { ...(WEBHOOK_SECRET ? { secret: WEBHOOK_SECRET } : {}), ...body };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WEBHOOK_AUTH_HEADER ? { Authorization: WEBHOOK_AUTH_HEADER } : {})
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error(`[n8n] ${label}: fetch failed`, e);
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    console.error(`[n8n] ${label}: webhook failed`, { status: res.status, body: msg.slice(0, 2000) });
    throw new Error(`n8n webhook failed (${res.status}): ${msg}`);
  }
}

/** E-Mail-Bestätigung nach Registrierung */
export async function sendSignupConfirmation(params: {
  email: string;
  magicLink: string;
  fullName?: string;
}): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK;
  if (!url) {
    throw new Error("Signup email webhook is not configured (N8N_WEBHOOK_URL_SEND_MAGIC_LINK).");
  }
  if (!HAS_WEBHOOK_AUTH) {
    throw new Error("n8n webhook auth is not configured (N8N_WEBHOOK_SECRET or N8N_WEBHOOK_AUTHORIZATION).");
  }
  await callWebhook(
    url,
    {
    type: "signup",
    email: params.email,
    magicLink: params.magicLink,
    fullName: params.fullName ?? null
    },
    "send-magic-link"
  );
}

/** Passwort-Reset-Link */
export async function sendPasswordReset(params: {
  email: string;
  resetLink: string;
  fullName?: string;
}): Promise<void> {
  await callWebhook(
    process.env.N8N_WEBHOOK_URL_SEND_PASSWORD_RESET,
    {
      email: params.email,
      resetLink: params.resetLink,
      fullName: params.fullName ?? null
    },
    "send-password-reset"
  );
}

/** Mitglied-Einladung (einzeln oder bulk) */
export async function sendMemberInvite(params: {
  email: string;
  inviteUrl: string;
  organizationName: string;
  inviterName?: string;
  role?: string;
}): Promise<void> {
  await callWebhook(
    process.env.N8N_WEBHOOK_URL_SEND_INVITE,
    {
      email: params.email,
      confirmLink: params.inviteUrl,
      organizationName: params.organizationName,
      inviterName: params.inviterName ?? null,
      role: params.role ?? "Mitglied"
    },
    "send-invite"
  );
}

/** Support / Feedback / Löschanfrage → n8n (z. B. info@lyniqmedia.com) */
export async function sendSupportRequest(params: {
  email: string;
  name?: string;
  type: "support" | "bug" | "idea" | "delete" | "question";
  subject?: string;
  message: string;
  orgName?: string;
  orgSlug?: string;
}): Promise<void> {
  await callWebhook(
    process.env.N8N_WEBHOOK_URL_SEND_SUPPORT,
    {
      email: params.email,
      name: params.name ?? null,
      type: params.type,
      subject: params.subject ?? null,
      message: params.message,
      orgName: params.orgName ?? null,
      orgSlug: params.orgSlug ?? null
    },
    "send-support"
  );
}

/** Sofort-Benachrichtigung bei Schicht-Zuweisung */
export async function sendShiftAssigned(params: {
  email: string;
  fullName?: string;
  eventName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  orgName: string;
  orgSlug: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_SHIFT_ASSIGNED, {
    email: params.email,
    fullName: params.fullName ?? null,
    eventName: params.eventName,
    date: params.date,
    startTime: params.startTime ?? null,
    endTime: params.endTime ?? null,
    location: params.location ?? null,
    orgName: params.orgName,
    orgSlug: params.orgSlug
  }, "send-shift-assigned");
}

/** Sofort-Benachrichtigung bei Aufgaben-Zuweisung */
export async function sendTaskAssigned(params: {
  email: string;
  fullName?: string;
  taskTitle: string;
  description?: string;
  dueAt?: string;
  orgName: string;
  orgSlug: string;
  taskUrl?: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_TASK_ASSIGNED, {
    email: params.email,
    fullName: params.fullName ?? null,
    taskTitle: params.taskTitle,
    description: params.description ?? null,
    dueAt: params.dueAt ?? null,
    orgName: params.orgName,
    orgSlug: params.orgSlug,
    taskUrl: params.taskUrl ?? null
  }, "send-task-assigned");
}

/** 24h-Erinnerung vor Task-Deadline (Cron) */
export async function sendTaskReminder(params: {
  email: string;
  fullName?: string;
  taskTitle: string;
  dueAt?: string;
  orgName: string;
  orgSlug: string;
  taskUrl?: string;
}): Promise<void> {
  await callWebhook(process.env.N8N_WEBHOOK_URL_SEND_TASK_REMINDER, {
    email: params.email,
    fullName: params.fullName ?? null,
    taskTitle: params.taskTitle,
    dueAt: params.dueAt ?? null,
    orgName: params.orgName,
    orgSlug: params.orgSlug,
    taskUrl: params.taskUrl ?? null
  }, "send-task-reminder");
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
  await callWebhook(
    process.env.N8N_WEBHOOK_URL_SEND_SHIFT_REMINDER,
    {
      email: params.email,
      fullName: params.fullName ?? null,
      eventName: params.eventName,
      date: params.date,
      startTime: params.startTime ?? null,
      orgName: params.orgName
    },
    "send-shift-reminder"
  );
}

