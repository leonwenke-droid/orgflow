export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, error: "Email provider not configured." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text
    })
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    return { ok: false, error: msg || `Email send failed (${res.status})` };
  }
  return { ok: true };
}

