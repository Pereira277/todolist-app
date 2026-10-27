"use client";

import { ComponentProps } from "react";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  helperText?: string;
  error?: string;
};

export function TextField({
  label,
  helperText,
  error,
  id,
  className = "",
  ...props
}: TextFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={fieldId}
        className={`h-11 w-full rounded-md border bg-surface px-3 text-base text-text-primary transition-colors duration-150 placeholder:text-text-secondary hover:border-text-secondary focus-visible:border-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled disabled:border-border ${error ? "border-error" : "border-border-strong"} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : helperText ? `${fieldId}-help` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="m-0 flex items-start gap-1 text-sm text-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${fieldId}-help`} className="m-0 text-sm text-text-secondary">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
