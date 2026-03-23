import { TASK_STATUS_COLORS, formatTaskStatus, type AppLocale } from "../../lib/formatters";

export interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  locale?: AppLocale;
  className?: string;
}

export function StatusBadge({ status, size = "sm", locale = "de", className = "" }: StatusBadgeProps) {
  const label = formatTaskStatus(status, locale);
  const colors = TASK_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colors} ${className}`.trim()}>
      {label}
    </span>
  );
}
