"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type TopBarProps = {
  name: string;
  email: string;
  onSignOut: () => void;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function TopBar({ name, email, onSignOut }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <header className="flex h-14 w-full items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
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

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold tracking-[0.02em] text-primary">
            {initialsOf(name)}
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-md border border-border bg-surface p-1 shadow-2">
            <div className="mb-1 border-b border-border px-3 pt-2 pb-3">
              <p className="m-0 text-sm font-semibold text-text-primary">{name}</p>
              <p className="m-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap text-text-secondary">
                {email}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-10 w-full items-center gap-2 rounded-sm border-0 bg-transparent px-3 text-left text-sm font-medium text-text-primary hover:bg-surface-sunken"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
