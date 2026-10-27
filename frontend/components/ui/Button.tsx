"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary enabled:hover:bg-primary-hover",
  secondary:
    "border-border-strong bg-surface text-text-primary enabled:hover:border-text-secondary enabled:hover:bg-background",
  ghost: "bg-transparent text-primary enabled:hover:bg-surface-sunken enabled:hover:text-primary-hover",
  destructive: "bg-error text-on-primary enabled:hover:bg-error-hover",
};

// A loading button keeps its variant colors; only a plain disabled one is greyed out
const disabledClasses =
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-sunken disabled:text-text-disabled";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  fullWidth = false,
  loading = false,
  loadingLabel,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 ${variantClasses[variant]} ${loading ? "cursor-progress" : disabledClasses} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      <span className={loading ? "invisible" : ""}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-r-transparent" />
          {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
        </span>
      )}
    </button>
  );
}
