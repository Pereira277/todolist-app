"use client";

import Link from "next/link";
import { ActionMenu } from "@/components/ui/ActionMenu";

type ListRowProps = {
  name: string;
  meta: string;
  href: string;
  saving?: boolean;
  savingLabel?: string;
  menuTriggerId?: string;
  onRename: () => void;
  onDelete: () => void;
};

export function ListRow({
  name,
  meta,
  href,
  saving = false,
  savingLabel = "Saving changes to the list",
  menuTriggerId,
  onRename,
  onDelete,
}: ListRowProps) {
  return (
    <div
      aria-busy={saving || undefined}
      className="relative box-border flex min-h-[68px] items-center gap-2 pr-2 shadow-[0_-1px_0_var(--color-border)] group-first/row:shadow-none"
    >
      <Link
        href={href}
        aria-disabled={saving || undefined}
        tabIndex={saving ? -1 : undefined}
        className={`group/link flex min-w-0 flex-1 flex-col justify-center self-stretch rounded-md py-3 pr-2 pl-5 text-text-primary no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring max-[480px]:pl-4 ${saving ? "pointer-events-none" : ""}`}
      >
        <span
          className={`overflow-hidden text-base leading-6 font-medium text-ellipsis whitespace-nowrap group-hover/link:text-primary group-hover/link:underline group-hover/link:underline-offset-2 ${saving ? "text-text-disabled" : ""}`}
        >
          {name}
        </span>
        <span className={`text-sm leading-5 ${saving ? "text-text-disabled" : "text-text-secondary"}`}>{meta}</span>
      </Link>
      {saving ? (
        <span className="inline-flex h-11 w-11 flex-none items-center justify-center text-text-secondary">
          <span
            aria-hidden="true"
            className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <span className="sr-only">{savingLabel}</span>
        </span>
      ) : (
        <ActionMenu
          label={`Actions for ${name}`}
          triggerId={menuTriggerId}
          items={[
            { label: "Rename", icon: "pencil", onSelect: onRename },
            { label: "Delete", icon: "trash", destructive: true, onSelect: onDelete },
          ]}
        />
      )}
    </div>
  );
}
