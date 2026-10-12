import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-6 bg-background px-4 pt-10 pb-10 text-text-primary sm:px-6 sm:pt-16">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-text-primary no-underline">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-primary shadow-1"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-on-primary"
          >
            <path d="M5 10.5l3.2 3.2L15 6.5" />
          </svg>
        </span>
        <span className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em]">Todo</span>
      </Link>
      <div className="flex w-full max-w-[400px] flex-col gap-5">{children}</div>
    </div>
  );
}
