import Link from "next/link";
import { OrgFlowLogoMark } from "./OrgFlowLogoMark";

type Size = "sm" | "md";

const markBox: Record<Size, { box: string; icon: string }> = {
  sm: { box: "h-8 w-8 rounded-[7px]", icon: "h-4 w-4" },
  md: { box: "h-9 w-9 rounded-[7px]", icon: "h-[18px] w-[18px]" },
};

/**
 * Wordmark + Symbol (Brand Guide: 9px Gap, 18px Wortmarke, Mark 28×28 / 7px Radius).
 * SVG-only exports: /orgflow-logo-horizontal-light.svg · /orgflow-logo-horizontal-dark.svg
 */
export function OrgFlowLogoLockup({
  href = "/",
  size = "md",
  className = "",
  prefetch,
}: {
  href?: string;
  size?: Size;
  className?: string;
  prefetch?: boolean;
}) {
  const { box, icon } = markBox[size];
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`inline-flex items-center gap-2.5 no-underline hover:no-underline hover:opacity-90 ${className}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center bg-[#0c0c0b] text-white ${box}`}
        aria-hidden
      >
        <OrgFlowLogoMark className={icon} />
      </span>
      <span className="font-sans text-[18px] font-medium leading-none tracking-[-0.01em] text-text-primary">
        OrgFlow
      </span>
    </Link>
  );
}
