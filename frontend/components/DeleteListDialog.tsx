"use client";

import { Dialog } from "@/components/ui/Dialog";
import type { List } from "@/lib/api";
import { deleteListDescription } from "@/lib/lists";

type DeleteListDialogProps = {
  list: Pick<List, "name" | "taskCount">;
  deleting: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Delete confirmation shared by My lists and List detail */
export function DeleteListDialog({ list, deleting, error, onConfirm, onCancel }: DeleteListDialogProps) {
  return (
    <Dialog
      destructive
      title={`Delete ‘${list.name}’?`}
      description={deleteListDescription(list.taskCount)}
      confirmLabel="Delete list"
      loading={deleting}
      loadingLabel="Deleting list"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {error && (
        <p role="alert" className="m-0 text-sm text-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}
