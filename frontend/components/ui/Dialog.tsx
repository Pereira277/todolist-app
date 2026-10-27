"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";

type DialogProps = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  destructive?: boolean;
  /** Renders the dialog as a form, so Enter in its field submits */
  asForm?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Modal confirmation dialog that can also host a one-field form.
 *
 * Keeps keyboard focus inside while open, closes on Escape unless it is busy,
 * and gives focus back to the element that opened it.
 *
 * @param props - Copy, busy state and callbacks; children go into the body
 * @returns The dialog layer, rendered over the page
 */
export function Dialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  loadingLabel,
  destructive = false,
  asForm = false,
  onConfirm,
  onCancel,
  children,
}: DialogProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement & HTMLFormElement>(null);
  const loadingRef = useRef(loading);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    loadingRef.current = loading;
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // A field gets focus first; otherwise Cancel, so Enter never confirms a delete by accident
    const first = panel?.querySelector<HTMLElement>("input:not(:disabled)") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!loadingRef.current) onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        // Every control is disabled while saving; keep focus on the panel itself
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstEl || !panel.contains(active))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (active === lastEl || !panel.contains(active))) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!loading) onConfirm();
  }

  const Panel = asForm ? "form" : "div";

  return (
    <div className="fixed inset-0 z-50 box-border flex items-center justify-center p-4 max-[480px]:items-end">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(28,28,26,0.45)]"
        onClick={loading ? undefined : onCancel}
      />
      <Panel
        ref={panelRef}
        role={destructive ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        aria-busy={loading || undefined}
        tabIndex={-1}
        noValidate={asForm || undefined}
        onSubmit={asForm ? handleSubmit : undefined}
        className="relative m-0 box-border flex w-full max-w-[440px] flex-col gap-2 rounded-lg bg-surface p-6 shadow-2 outline-none"
      >
        <h2
          id={`${id}-title`}
          className="m-0 text-[22px] leading-[30px] font-semibold text-text-primary [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        {description && (
          <p id={`${id}-desc`} className="m-0 text-base leading-6 text-text-secondary">
            {description}
          </p>
        )}
        {children && <div className="mt-3 flex flex-col gap-5">{children}</div>}
        <div className="mt-6 flex justify-end gap-3 max-[480px]:flex-col-reverse">
          <Button variant="secondary" onClick={onCancel} disabled={loading} className="max-[480px]:w-full">
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            type={asForm ? "submit" : "button"}
            onClick={asForm ? undefined : onConfirm}
            loading={loading}
            loadingLabel={loadingLabel}
            className="max-[480px]:w-full"
          >
            {confirmLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
