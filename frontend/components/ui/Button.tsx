"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary:
    "border-border-strong bg-surface text-text-primary hover:border-text-secondary hover:bg-background",
  ghost: "bg-transparent text-primary hover:bg-surface-sunken hover:text-primary-hover",
};

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
      className={`relative inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-sunken disabled:text-text-disabled ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${loading ? "cursor-progress" : ""} ${className}`}
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
