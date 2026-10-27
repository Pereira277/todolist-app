import type { ReactNode } from "react";

// Paths from the design system icon set, drawn on a 20x20 grid
const paths: Record<IconName, ReactNode> = {
  more: (
    <>
      <circle cx="10" cy="4.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  pencil: (
    <>
      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
      <path d="M11.5 5.5l3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6h12" />
      <path d="M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6" />
      <path d="M5.5 6l.8 9.6A1.5 1.5 0 0 0 7.8 17h4.4a1.5 1.5 0 0 0 1.5-1.4L14.5 6" />
      <path d="M8.5 9v5" />
      <path d="M11.5 9v5" />
    </>
  ),
  list: (
    <>
      <path d="M7.5 6h8" />
      <path d="M7.5 10h8" />
      <path d="M7.5 14h8" />
      <path d="M4.5 6h.01" />
      <path d="M4.5 10h.01" />
      <path d="M4.5 14h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6.5v4" />
      <path d="M10 13.5h.01" />
    </>
  ),
};

export type IconName = "more" | "pencil" | "trash" | "list" | "error";

type IconProps = {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="flex-none"
    >
      {paths[name]}
    </svg>
  );
}
