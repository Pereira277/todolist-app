const NAME_WIDTHS = ["62%", "44%", "72%", "52%", "36%"];

const bar = "block rounded-sm bg-[linear-gradient(90deg,var(--color-surface-sunken)_0%,var(--color-background)_50%,var(--color-surface-sunken)_100%)] bg-[length:200%_100%] animate-shimmer";

export function SkeletonRow({ index = 0 }: { index?: number }) {
  return (
    <div
      aria-hidden="true"
      className="box-border flex min-h-[68px] items-center gap-4 pr-4 pl-5 shadow-[0_-1px_0_var(--color-border)] first:shadow-none"
    >
      <span className="flex flex-1 flex-col gap-2">
        <span className={`${bar} h-3.5`} style={{ width: NAME_WIDTHS[index % NAME_WIDTHS.length] }} />
        <span className={`${bar} h-2.5 w-[88px]`} />
      </span>
      <span className={`${bar} mr-3 h-5 w-5 flex-none`} />
    </div>
  );
}
