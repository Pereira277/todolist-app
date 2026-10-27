import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: IconName;
  tone?: "neutral" | "error";
  /** Announces the message when it appears, e.g. after a failed load */
  live?: boolean;
  children?: ReactNode;
};

export function EmptyState({ title, description, icon, tone = "neutral", live = false, children }: EmptyStateProps) {
  const isError = tone === "error";
  return (
    <div
      role={live ? (isError ? "alert" : "status") : undefined}
      className="box-border flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-6 py-12 text-center shadow-1 max-[480px]:px-4 max-[480px]:py-10"
    >
      <span
        aria-hidden="true"
        className={`mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full ${isError ? "bg-error-soft text-error" : "bg-primary-soft text-primary"}`}
      >
        <Icon name={icon ?? (isError ? "error" : "list")} size={24} />
      </span>
      <h2 className="m-0 text-[22px] leading-[30px] font-semibold text-text-primary">{title}</h2>
      {description && <p className="m-0 max-w-[380px] text-base leading-6 text-text-secondary">{description}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
