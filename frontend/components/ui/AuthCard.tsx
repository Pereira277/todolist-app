import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-lg border border-border bg-surface p-6 shadow-1 sm:p-8">
      <div className="mb-6">
        <h1 className="m-0 text-[22px] leading-[30px] font-semibold text-text-primary">{title}</h1>
        <p className="mt-1 mb-0 text-sm text-text-secondary">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}
