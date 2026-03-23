"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
import { buttonClassName } from "./ui/Button";
import type { ButtonVariant } from "./ui/Button";

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
      aria-hidden
    />
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  loadingLabel?: string;
  /** When set, base styles come from the design-system Button (merged with `className`). */
  variant?: ButtonVariant;
  buttonSize?: "sm" | "md";
};

/**
 * Submit-Button, der während des Form-Submits disabled wird und ein Ladesymbol anzeigt.
 * Muss innerhalb eines <form> mit action (Server Action) verwendet werden.
 */
export default function SubmitButtonWithSpinner({
  children,
  loadingLabel,
  disabled,
  className = "",
  variant,
  buttonSize = "sm",
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  const mergedClassName =
    variant != null ? buttonClassName(variant, buttonSize, className) : className;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={mergedClassName}
      aria-busy={pending}
      {...rest}
    >
      {pending ? (
        <>
          <Spinner />
          <span className={loadingLabel ? "ml-1.5" : ""}>
            {loadingLabel ?? children}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
