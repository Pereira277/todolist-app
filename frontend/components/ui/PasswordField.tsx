"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  helperText?: string;
  error?: string;
};

export function PasswordField({
  label,
  helperText,
  error,
  id,
  className = "",
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? props.name;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          className={`h-11 w-full rounded-md border bg-surface px-3 pr-[72px] text-base text-text-primary transition-colors duration-150 placeholder:text-text-secondary hover:border-text-secondary focus-visible:border-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled disabled:border-border ${error ? "border-error" : "border-border-strong"} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : helperText ? `${fieldId}-help` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1 h-9 min-w-[60px] rounded-sm px-3 text-sm font-medium text-primary hover:bg-surface-sunken hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-0"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
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
