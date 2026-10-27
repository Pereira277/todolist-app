"use client";

import { type ChangeEvent, type KeyboardEvent, type Ref, useId } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Task } from "@/lib/api";

type TaskRowProps = {
  task: Task;
  /** Request in flight for this task: disables the row and shows a spinner */
  saving?: boolean;
  editing?: boolean;
  draft?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onToggle: () => void;
  onEdit: () => void;
  onDraftChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

// Stable ids so the page can move focus back to a control after it re-renders
export const taskTitleId = (taskId: string) => `task-title-${taskId}`;
export const taskCheckId = (taskId: string) => `task-check-${taskId}`;
export const taskDeleteId = (taskId: string) => `task-delete-${taskId}`;

export function TaskRow({
  task,
  saving = false,
  editing = false,
  draft = "",
  error,
  inputRef,
  onToggle,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
  onDelete,
}: TaskRowProps) {
  const id = useId();
  const { title, done } = task;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!saving) onSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (!saving) onCancel();
    }
  }

  return (
    <div
      aria-busy={saving || undefined}
      className="relative box-border flex min-h-14 items-start gap-1 py-1.5 pr-2 pl-1 shadow-[0_-1px_0_var(--color-border)] group-first/row:shadow-none"
    >
      <label htmlFor={taskCheckId(task.id)} className="group/check inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center">
        <span className="relative h-5 w-5 flex-none">
          <input
            id={taskCheckId(task.id)}
            type="checkbox"
            checked={done}
            onChange={onToggle}
            disabled={saving || editing}
            aria-label={`${done ? "Mark as not done" : "Mark as done"}: ${title}`}
            className="peer m-0 h-5 w-5 cursor-pointer appearance-none rounded-sm border-[1.5px] border-border-strong bg-surface transition-colors duration-100 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring enabled:group-hover/check:border-text-primary enabled:checked:group-hover/check:border-primary-hover enabled:checked:group-hover/check:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:checked:border-text-disabled disabled:checked:bg-text-disabled"
          />
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-5 w-5 text-on-primary opacity-0 peer-checked:opacity-100"
          >
            <path d="M5.5 10.3l3 3 6-6.6" />
          </svg>
        </span>
      </label>

      {editing ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
          <input
            ref={inputRef}
            type="text"
            aria-label="Task title"
            autoComplete="off"
            value={draft}
            onChange={onDraftChange}
            onKeyDown={handleKeyDown}
            disabled={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            className={`box-border h-11 w-full rounded-md border bg-surface px-3 text-base text-text-primary transition-colors duration-150 hover:enabled:border-text-secondary focus-visible:border-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-text-disabled ${error ? "border-error" : "border-border-strong"}`}
          />
          {error ? (
            <p id={`${id}-error`} className="m-0 flex items-start gap-1 text-sm text-error">
              <span className="mt-0.5">
                <Icon name="error" size={16} />
              </span>
              <span>{error}</span>
            </p>
          ) : (
            <p id={`${id}-hint`} className="m-0 text-sm text-text-secondary max-sm:sr-only">
              Press Enter to save, Esc to cancel.
            </p>
          )}
          {/* Touch screens have no Enter or Esc at hand, so they get buttons instead of the hint */}
          <div className="flex justify-end gap-3 sm:hidden">
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={saving} loadingLabel="Saving task">
              Save
            </Button>
          </div>
        </div>
      ) : (
        <button
          id={taskTitleId(task.id)}
          type="button"
          onClick={onEdit}
          disabled={saving}
          aria-label={`Edit task: ${title}`}
          className={`m-0 box-border flex min-h-11 min-w-0 flex-1 cursor-text items-center rounded-md border-0 bg-transparent px-2 py-2.5 text-left text-base leading-6 [overflow-wrap:anywhere] enabled:hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring ${
            saving ? "cursor-progress text-text-disabled" : done ? "text-text-secondary line-through" : "text-text-primary"
          }`}
        >
          {title}
        </button>
      )}

      {saving && !editing ? (
        <span className="inline-flex h-11 w-11 flex-none items-center justify-center text-text-secondary">
          <span
            aria-hidden="true"
            className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <span className="sr-only">Saving task</span>
        </span>
      ) : (
        <button
          id={taskDeleteId(task.id)}
          type="button"
          onClick={onDelete}
          disabled={saving || editing}
          aria-label={`Delete task: ${title}`}
          className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-text-secondary transition-colors duration-150 enabled:hover:bg-error-soft enabled:hover:text-error focus-visible:outline-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:text-text-disabled ${editing ? "max-sm:hidden" : ""}`}
        >
          <Icon name="trash" size={18} />
        </button>
      )}
    </div>
  );
}
