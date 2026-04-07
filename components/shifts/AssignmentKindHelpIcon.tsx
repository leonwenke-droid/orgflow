"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import { parseAssignmentKind } from "../../lib/shiftAssignmentKind";

type Props = {
  kind: string | null | undefined;
  className?: string;
  /** Larger tap target on touch UIs */
  size?: "sm" | "md";
};

/**
 * Help icon: hover (fine pointer) shows tooltip; tap toggles on touch.
 */
export default function AssignmentKindHelpIcon({ kind, className, size = "sm" }: Props) {
  const { locale } = useLocale();
  const k = parseAssignmentKind(kind);
  const text = t(`shifts.assignment_kind_tooltip_${k}` as "shifts.assignment_kind_tooltip_self_signup", locale);
  const [prefersHover, setPrefersHover] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [tapOpen, setTapOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setPrefersHover(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (prefersHover || !tapOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const el = btnRef.current;
      if (el && !el.contains(e.target as Node)) setTapOpen(false);
    };
    document.addEventListener("click", close, true);
    document.addEventListener("touchend", close, true);
    return () => {
      document.removeEventListener("click", close, true);
      document.removeEventListener("touchend", close, true);
    };
  }, [tapOpen, prefersHover]);

  const visible = prefersHover ? hoverOpen : tapOpen;

  const iconClass =
    size === "md" ? "h-4 w-4 sm:h-[18px] sm:w-[18px]" : "h-3.5 w-3.5 sm:h-4 sm:w-4";

  return (
    <span className={`relative inline-flex shrink-0 items-center ${className ?? ""}`}>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex rounded-full p-0.5 text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary dark:text-gray-400 dark:hover:text-gray-100 dark:focus-visible:ring-offset-bg-primary"
        aria-label={text}
        aria-expanded={visible}
        onMouseEnter={() => prefersHover && setHoverOpen(true)}
        onMouseLeave={() => prefersHover && setHoverOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!prefersHover) setTapOpen((v) => !v);
        }}
      >
        <HelpCircle className={iconClass} strokeWidth={2} aria-hidden />
      </button>
      {visible ? (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-[200] mt-1.5 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-border-default bg-bg-primary px-3.5 py-2.5 text-left text-[11px] leading-relaxed text-text-primary shadow-lg whitespace-normal break-words [hyphens:auto] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
