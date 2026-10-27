const NAME_WIDTHS = ["62%", "44%", "72%", "52%", "36%"];

export const skeletonBar =
  "block rounded-sm bg-[linear-gradient(90deg,var(--color-surface-sunken)_0%,var(--color-background)_50%,var(--color-surface-sunken)_100%)] bg-[length:200%_100%] animate-shimmer";

type SkeletonRowProps = {
  index?: number;
  /** Mimics a task row (checkbox, one line) instead of a list row (two lines) */
  variant?: "list" | "task";
};

export function SkeletonRow({ index = 0, variant = "list" }: SkeletonRowProps) {
  const task = variant === "task";
  return (
    <div
      aria-hidden="true"
      className={`box-border flex items-center gap-4 pr-4 shadow-[0_-1px_0_var(--color-border)] first:shadow-none ${task ? "min-h-14 pl-4" : "min-h-[68px] pl-5"}`}
    >
      {task && <span className={`${skeletonBar} ml-3 h-5 w-5 flex-none`} />}
      <span className="flex flex-1 flex-col gap-2">
        <span className={`${skeletonBar} h-3.5`} style={{ width: NAME_WIDTHS[index % NAME_WIDTHS.length] }} />
        {!task && <span className={`${skeletonBar} h-2.5 w-[88px]`} />}
      </span>
      <span className={`${skeletonBar} mr-3 h-5 w-5 flex-none`} />
    </div>
  );
}
