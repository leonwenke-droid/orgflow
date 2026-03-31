/**
 * OrgFlow symbol (brand guide): four quadrants on 18×18 viewBox, stroke-free.
 * Use with `text-white` on dark marks or `text-[#0c0c0b]` on light containers.
 */
export function OrgFlowLogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1" y="1" width="7" height="7" rx="2" fill="currentColor" />
      <rect x="10" y="1" width="7" height="7" rx="2" fill="currentColor" opacity="0.5" />
      <rect x="1" y="10" width="7" height="7" rx="2" fill="currentColor" opacity="0.5" />
      <rect x="10" y="10" width="7" height="7" rx="2" fill="currentColor" opacity="0.25" />
    </svg>
  );
}
