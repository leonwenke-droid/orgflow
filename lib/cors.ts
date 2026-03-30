import { NextResponse } from "next/server";

export type CorsOptions = {
  allowOrigins: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  allowCredentials?: boolean;
  maxAgeSeconds?: number;
};

export function corsPreflight(req: Request, opts: CorsOptions): NextResponse | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin") ?? "";
  if (!origin || !opts.allowOrigins.includes(origin)) {
    return new NextResponse(null, { status: 204 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", (opts.allowMethods ?? ["GET","POST","PUT","PATCH","DELETE","OPTIONS"]).join(", "));
  res.headers.set("Access-Control-Allow-Headers", (opts.allowHeaders ?? ["Content-Type","Authorization"]).join(", "));
  if (opts.allowCredentials) res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Max-Age", String(opts.maxAgeSeconds ?? 600));
  return res;
}

export function applyCors(res: NextResponse, req: Request, opts: CorsOptions): NextResponse {
  const origin = req.headers.get("origin") ?? "";
  if (!origin || !opts.allowOrigins.includes(origin)) return res;
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  if (opts.allowCredentials) res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}

