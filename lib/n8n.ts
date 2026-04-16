/**
 * Zentraler n8n-Webhook-Client.
 * Alle ausgehenden E-Mails laufen über diese Funktionen.
 */

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET ?? "";
const WEBHOOK_AUTH_HEADER = (process.env.N8N_WEBHOOK_AUTHORIZATION ?? "").trim();
const HAS_WEBHOOK_AUTH = !!WEBHOOK_SECRET || !!WEBHOOK_AUTH_HEADER;

async function callWebhook(
  url: string | undefined,
  body: Record<string, unknown>,
  label: string
): Promise<void> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H1',location:'lib/n8n.ts:callWebhook:entry',message:'callWebhook invoked',data:{label,hasUrl:!!url,hasSecret:!!WEBHOOK_SECRET,hasAuthHeader:!!WEBHOOK_AUTH_HEADER},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!url) {
    console.warn(`[n8n] ${label}: Webhook URL not configured — skipping`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H2',location:'lib/n8n.ts:callWebhook:noUrl',message:'Webhook skipped: missing URL',data:{label},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return;
  }
  // Either a shared secret (in body) OR an Authorization header can secure the webhook.
  if (!WEBHOOK_SECRET && !WEBHOOK_AUTH_HEADER) {
    console.warn(
      `[n8n] ${label}: neither N8N_WEBHOOK_SECRET nor N8N_WEBHOOK_AUTHORIZATION configured — skipping`
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H2',location:'lib/n8n.ts:callWebhook:noAuth',message:'Webhook skipped: missing auth config',data:{label},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H3',location:'lib/n8n.ts:callWebhook:fetchCatch',message:'Webhook fetch threw',data:{label,name:(e as any)?.name??null,hasMessage:!!(e as any)?.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    console.error(`[n8n] ${label}: webhook failed`, { status: res.status, body: msg.slice(0, 2000) });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H4',location:'lib/n8n.ts:callWebhook:notOk',message:'Webhook responded not ok',data:{label,status:res.status,hasBody:!!msg},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(`n8n webhook failed (${res.status}): ${msg}`);
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H1',location:'lib/n8n.ts:callWebhook:ok',message:'Webhook ok',data:{label,status:res.status},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

/** E-Mail-Bestätigung nach Registrierung */
export async function sendSignupConfirmation(params: {
  email: string;
  magicLink: string;
  fullName?: string;
}): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'post-fix',hypothesisId:'H2',location:'lib/n8n.ts:sendSignupConfirmation:precheck',message:'sendSignupConfirmation precheck',data:{hasUrl:!!url,hasAuth:HAS_WEBHOOK_AUTH,hasFullName:!!params.fullName,magicLinkLen:(params.magicLink??'').length,magicLinkHasRedirectTo:(params.magicLink??'').includes('redirect_to='),magicLinkHasAuthCallback:(params.magicLink??'').includes('/auth/callback'),magicLinkHasNext:(params.magicLink??'').includes('next=')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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

