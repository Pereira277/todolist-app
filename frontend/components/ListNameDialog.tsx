"use client";

import type { ChangeEvent, Ref } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";

type ListNameDialogProps = {
  mode: "create" | "rename";
  value: string;
  error?: string;
  saving: boolean;
  inputRef: Ref<HTMLInputElement>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

/** New list and Rename list dialogs, shared by My lists and List detail */
export function ListNameDialog({ mode, value, error, saving, inputRef, onChange, onConfirm, onCancel }: ListNameDialogProps) {
  const create = mode === "create";
  return (
    <Dialog
      asForm
      title={create ? "New list" : "Rename list"}
      confirmLabel={create ? "Create list" : "Save"}
      loading={saving}
      loadingLabel={create ? "Creating list" : "Saving name"}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <TextField
        ref={inputRef}
        id="list-name"
        label="Name"
        placeholder={create ? "e.g. Groceries" : undefined}
        helperText="Up to 60 characters."
        autoComplete="off"
        value={value}
        onChange={onChange}
        readOnly={saving}
        error={error}
      />
    </Dialog>
  );
}
