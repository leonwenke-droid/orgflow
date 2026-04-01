/**
 * OrgFlow symbol — 18×18 viewBox, vier Quadranten (docs/brand/orgflow_brand_guide.html).
 * Statische Varianten: /logo-mark.svg (auf hellem Grund), /logo-mark-on-dark.svg, /logo-mark-on-brand.svg
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
