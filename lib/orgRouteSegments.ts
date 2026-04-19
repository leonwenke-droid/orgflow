/**
 * First URL path segment must not be interpreted as an organisation slug (sidebar, header org links, footer legal URLs).
 * Keep in sync with `app/(marketing)/` top-level routes and global app paths.
 */
const NON_ORG_TOP_SEGMENTS = new Set<string>([
  "admin",
  "dashboard",
  "login",
  "signup",
  "super-admin",
  "task",
  "api",
  "claim-org",
  "auth",
  "create-organisation",
  "join",
  "imprint",
  "privacy",
  "terms",
  "invite",
  "onboarding",
  "avv",
  // Marketing / docs (app/(marketing)/…)
  "about",
  "blog",
  "changelog",
  "contact",
  "docs",
  "features",
  "preise",
  "roadmap",
  "status",
]);

export function isNonOrgTopSegment(segment: string): boolean {
  return NON_ORG_TOP_SEGMENTS.has(segment);
}
