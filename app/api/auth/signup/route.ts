import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { sendSignupConfirmation } from "../../../../lib/n8n";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H1',location:'app/api/auth/signup/route.ts:POST:entry',message:'Signup API called',data:{hasXff:!!req.headers.get('x-forwarded-for')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`signup:${ip}`, 5);
    if (!rl.ok) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H2',location:'app/api/auth/signup/route.ts:rateLimit',message:'Signup rate limited',data:{retryAfterMs:rl.retryAfterMs},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { message: "Zu viele Anfragen. Bitte warte einen Moment." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const { email, password, firstName, lastName, claimToken, next } = await req.json();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H1',location:'app/api/auth/signup/route.ts:parsedBody',message:'Parsed signup body',data:{hasEmail:!!email,passLen:typeof password==='string'?password.length:null,hasClaimToken:typeof claimToken==='string'&&!!claimToken.trim()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!email || !password) {
      return NextResponse.json(
        { message: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }
    if (String(password).length < 8) {
      return NextResponse.json(
        { message: "Passwort mindestens 8 Zeichen." },
        { status: 400 }
      );
    }

    const fullName = [String(firstName || "").trim(), String(lastName || "").trim()]
      .filter(Boolean)
      .join(" ")
      .trim() || undefined;

    const service = createSupabaseServiceRoleClient();

    let organizationId: string | undefined;
    if (claimToken && typeof claimToken === "string" && claimToken.trim()) {
      const { data: org } = await service
        .from("organizations")
        .select("id")
        .eq("setup_token", claimToken.trim())
        .is("setup_token_used_at", null)
        .eq("is_active", true)
        .single();
      if (org && (org as { id?: string }).id) organizationId = (org as { id: string }).id;
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H3',location:'app/api/auth/signup/route.ts:orgLookup',message:'Resolved org from claim token',data:{hasOrgId:!!organizationId,hasFullName:!!fullName},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const userMetadata: Record<string, string> = fullName ? { full_name: fullName } : {};
    if (organizationId) userMetadata.organization_id = organizationId;

    let baseUrl: string;
    try {
      // In local/dev we must use the current request origin (localhost),
      // otherwise magic links can point to production and fail.
      if (process.env.NODE_ENV !== "production") {
        baseUrl = new URL(req.url).origin;
      } else {
        const { getPublicBaseUrl } = await import("../../../../lib/publicBaseUrl");
        baseUrl = await getPublicBaseUrl();
      }
    } catch {
      baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H11',location:'app/api/auth/signup/route.ts:baseUrl',message:'Computed baseUrl/origin',data:{nodeEnv:process.env.NODE_ENV??null,reqOrigin:(new URL(req.url)).origin,baseUrlHost:(()=>{try{return new URL(baseUrl).host}catch{return null}})(),baseUrlStartsWithHttp:baseUrl.startsWith('http')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const rawNext = typeof next === "string" ? next.trim() : "";
    const nextPath =
      rawNext && rawNext.startsWith("/")
        ? rawNext
        : claimToken
          ? `/claim-org?token=${encodeURIComponent(claimToken)}`
          : "/";
    const redirectTo = baseUrl ? `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}` : undefined;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H4',location:'app/api/auth/signup/route.ts:redirectTo',message:'Computed redirectTo',data:{hasBaseUrl:!!baseUrl,hasRedirectTo:!!redirectTo,nextPathStartsWithSlash:nextPath.startsWith('/'),nextPathLen:nextPath.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const { data: linkData, error } = await service.auth.admin.generateLink({
      type: "signup",
      email: String(email).trim(),
      password: String(password),
      options: {
        data: userMetadata,
        ...(redirectTo && { redirectTo })
      }
    });

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H5',location:'app/api/auth/signup/route.ts:generateLink',message:'generateLink failed',data:{code:(error as any)?.code??null,hasMessage:!!(error as any)?.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { message: error.message || "Registrierung fehlgeschlagen." },
        { status: 400 }
      );
    }

    const actionLink =
      linkData?.properties?.action_link ??
      (linkData as { action_link?: string })?.action_link;
    if (!actionLink || typeof actionLink !== "string") {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H5',location:'app/api/auth/signup/route.ts:actionLink',message:'No action link from generateLink',data:{hasLinkData:!!linkData,hasProps:!!(linkData as any)?.properties},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { message: "Verifizierungs-Link konnte nicht erzeugt werden." },
        { status: 500 }
      );
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H9',location:'app/api/auth/signup/route.ts:actionLinkShape',message:'Action link shape (non-secret)',data:{len:actionLink.length,hasRedirectToParam:actionLink.includes('redirect_to=')||actionLink.includes('redirectTo='),hasAuthCallback:actionLink.includes('/auth/callback'),hasNextParam:actionLink.includes('next=')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H1',location:'app/api/auth/signup/route.ts:beforeSend',message:'About to call sendSignupConfirmation',data:{hasActionLink:true},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H7',location:'app/api/auth/signup/route.ts:envSnapshot',message:'Env snapshot (non-secret)',data:{hasMagicLinkUrl:!!process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK,magicLinkUrlLen:(process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK??'').length,hasAuthHeader:!!process.env.N8N_WEBHOOK_AUTHORIZATION,authHeaderLen:(process.env.N8N_WEBHOOK_AUTHORIZATION??'').length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await sendSignupConfirmation({
      email: String(email).trim(),
      magicLink: actionLink,
      fullName: fullName ?? undefined
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H1',location:'app/api/auth/signup/route.ts:afterSend',message:'sendSignupConfirmation resolved',data:{ok:true},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ message: "ok" });
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'595982'},body:JSON.stringify({sessionId:'595982',runId:'pre-fix',hypothesisId:'H6',location:'app/api/auth/signup/route.ts:catch',message:'Signup API threw',data:{name:(e as any)?.name??null,hasMessage:!!(e as any)?.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error(e);
    return NextResponse.json(
      { message: (e instanceof Error && e.message) ? e.message : "Unerwarteter Fehler." },
      { status: 500 }
    );
  }
}
