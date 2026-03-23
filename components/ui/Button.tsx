import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500",
  secondary:
    "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus-visible:ring-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-500",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 dark:text-gray-200 dark:hover:bg-gray-800"
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-gray-950";

const SIZE_SM = "px-3 py-1.5 text-xs";
const SIZE_MD = "px-4 py-2 text-sm";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
};

export function buttonClassName(variant: ButtonVariant = "primary", size: "sm" | "md" = "md", extra?: string): string {
  const sizeClass = size === "sm" ? SIZE_SM : SIZE_MD;
  return [BASE, VARIANT_CLASSES[variant], sizeClass, extra].filter(Boolean).join(" ");
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...rest },
  ref
) {
  return <button ref={ref} type={type} className={buttonClassName(variant, size, className)} {...rest} />;
});

Button.displayName = "Button";
