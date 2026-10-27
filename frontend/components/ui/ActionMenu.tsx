"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export type ActionMenuItem = {
  label: string;
  icon: IconName;
  destructive?: boolean;
  onSelect: () => void;
};

type ActionMenuProps = {
  /** Accessible name of the trigger, e.g. "Actions for Groceries" */
  label: string;
  items: ActionMenuItem[];
  /** Marks the trigger so the page can move focus back to it */
  triggerId?: string;
};

/**
 * Kebab button that opens a menu of row actions.
 *
 * Follows the menu button pattern: Enter, Space or the arrow keys open it and
 * focus an item, arrows and Home/End move between items, Escape closes it and
 * returns focus to the trigger, and Tab closes it.
 *
 * @param props - Trigger label and the menu items
 * @returns The trigger with its menu
 */
export function ActionMenu({ label, items, triggerId }: ActionMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openAt(index: number) {
    setFocusIndex(index);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAt(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(items.length - 1);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = items.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusIndex((i) => (i === last ? 0 : i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusIndex((i) => (i === 0 ? last : i - 1));
        break;
      case "Home":
        event.preventDefault();
        setFocusIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusIndex(last);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openAt(0))}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring aria-expanded:bg-surface-sunken aria-expanded:text-text-primary"
      >
        <Icon name="more" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="absolute top-[calc(100%+8px)] right-0 z-20 min-w-[180px] rounded-md border border-border bg-surface p-1 shadow-2"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => {
                // Focus goes back to the trigger first so a dialog opened next can return it there
                close();
                item.onSelect();
              }}
              className={`flex h-10 w-full items-center gap-2 rounded-sm border-0 bg-transparent px-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring ${
                item.destructive
                  ? "text-error hover:bg-error-soft focus-visible:bg-error-soft"
                  : "text-text-primary hover:bg-surface-sunken focus-visible:bg-surface-sunken"
              }`}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
