import type { ReactNode } from "react";

type AlertProps = {
  variant: "error" | "success";
  title: string;
  children: ReactNode;
};

export function Alert({ variant, title, children }: AlertProps) {
  const toneClasses =
    variant === "error" ? "border-error bg-error-soft text-error" : "border-success bg-success-soft text-success";

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex w-full items-start gap-3 rounded-md border px-4 py-3 text-sm ${toneClasses}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 flex-none"
      >
        {variant === "error" ? (
          <path
            d="M10 7v3.5M10 13.25h.01M9.08 3.6 2.98 14.4a1.5 1.5 0 0 0 1.3 2.25h11.44a1.5 1.5 0 0 0 1.3-2.25l-6.1-10.8a1.5 1.5 0 0 0-2.84 0Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle cx="10" cy="10" r="7.25" />
            <path d="M7 10.25 9.1 12.5 13.3 7.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
      <div className="min-w-0 flex-1 text-text-primary">
        <p className={`m-0 font-semibold ${variant === "error" ? "text-error" : "text-success"}`}>{title}</p>
        <p className="m-0 mt-0.5">{children}</p>
      </div>
    </div>
  );
}
