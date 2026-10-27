"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { fetchUserAttributes, signOut } from "aws-amplify/auth";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { TextField } from "@/components/ui/TextField";
import { ApiError, createList, deleteList, fetchLists, renameList, type List } from "@/lib/api";
import { listNameError } from "@/lib/validate";

type Profile = { name: string; email: string };

type ListsState = { status: "loading" } | { status: "error" } | { status: "ready"; lists: List[] };

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "rename"; list: List }
  | { kind: "delete"; list: List };

const SKELETON_ROWS = [0, 1, 2, 3];

function progressOf(list: List) {
  if (list.taskCount === 0) return "No tasks yet";
  if (list.doneCount === list.taskCount) return `All ${list.taskCount} done`;
  return `${list.doneCount} of ${list.taskCount} done`;
}

function deleteDescriptionOf(list: List) {
  if (list.taskCount === 0) return undefined;
  return `This also deletes its ${list.taskCount} ${list.taskCount === 1 ? "task" : "tasks"}.`;
}

// A 400 carries a message written for the user; anything else gets a generic one
function saveErrorOf(err: unknown, fallback: string) {
  return err instanceof ApiError && err.status === 400 ? err.message : fallback;
}

const menuTriggerId = (listId: string) => `list-actions-${listId}`;

export default function MyListsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listsState, setListsState] = useState<ListsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<(() => HTMLElement | null) | null>(null);

  // Moves focus once the target is rendered, unless the user already put it somewhere else
  useEffect(() => {
    if (!pendingFocus.current) return;
    if (document.activeElement && document.activeElement !== document.body) {
      pendingFocus.current = null;
      return;
    }
    const target = pendingFocus.current();
    if (target) {
      target.focus();
      pendingFocus.current = null;
    }
  });

  useEffect(() => {
    fetchUserAttributes()
      .then((attrs) => {
        setProfile({ name: attrs.name ?? "", email: attrs.email ?? "" });
      })
      .catch(() => {
        router.replace("/sign-in/");
      });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetchLists()
      .then((lists) => {
        if (!cancelled) setListsState({ status: "ready", lists });
      })
      .catch(() => {
        if (!cancelled) setListsState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const updateLists = useCallback((update: (lists: List[]) => List[]) => {
    setListsState((state) => (state.status === "ready" ? { status: "ready", lists: update(state.lists) } : state));
  }, []);

  function handleRetry() {
    setListsState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  function openCreate() {
    setNameValue("");
    setNameError(undefined);
    setDialog({ kind: "create" });
  }

  function openRename(list: List) {
    setNameValue(list.name);
    setNameError(undefined);
    setDialog({ kind: "rename", list });
  }

  function openDelete(list: List) {
    setDeleteError(undefined);
    setDialog({ kind: "delete", list });
  }

  function closeDialog() {
    setDialog({ kind: "none" });
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setNameValue(event.target.value);
    if (nameError) setNameError(undefined);
  }

  function showNameError(message: string) {
    setNameError(message);
    nameInputRef.current?.focus();
  }

  async function handleCreate() {
    const error = listNameError(nameValue);
    if (error) {
      showNameError(error);
      return;
    }
    setSubmitting(true);
    try {
      const list = await createList(nameValue.trim());
      updateLists((lists) => [list, ...lists]);
      closeDialog();
      // Creating from the empty state removes the button that opened the dialog
      pendingFocus.current = () => headingRef.current;
    } catch (err) {
      showNameError(saveErrorOf(err, "We couldn’t create the list. Try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRename(list: List) {
    const error = listNameError(nameValue);
    if (error) {
      showNameError(error);
      return;
    }
    const name = nameValue.trim();
    if (name === list.name) {
      closeDialog();
      return;
    }
    // The dialog closes right away and the row shows the new name while it saves.
    // Its menu button turns into a spinner, so focus returns to it once it is back
    closeDialog();
    pendingFocus.current = () => document.getElementById(menuTriggerId(list.id));
    setSavingId(list.id);
    updateLists((lists) => lists.map((l) => (l.id === list.id ? { ...l, name } : l)));
    try {
      const saved = await renameList(list.id, name);
      updateLists((lists) => lists.map((l) => (l.id === list.id ? saved : l)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        updateLists((lists) => lists.filter((l) => l.id !== list.id));
        pendingFocus.current = () => headingRef.current;
        return;
      }
      updateLists((lists) => lists.map((l) => (l.id === list.id ? { ...l, name: list.name } : l)));
      setNameValue(name);
      setNameError(saveErrorOf(err, "We couldn’t save the name. Try again."));
      setDialog({ kind: "rename", list });
    } finally {
      setSavingId(undefined);
    }
  }

  function removeDeleted(listId: string) {
    updateLists((lists) => lists.filter((l) => l.id !== listId));
    closeDialog();
    // The row and its menu button are gone; move focus somewhere stable
    pendingFocus.current = () => headingRef.current;
  }

  async function handleDelete(list: List) {
    setDeleteError(undefined);
    setSubmitting(true);
    try {
      await deleteList(list.id);
      removeDeleted(list.id);
    } catch (err) {
      // A 404 on the first attempt means the list was already gone
      if (err instanceof ApiError && err.status === 404) {
        removeDeleted(list.id);
        return;
      }
      setDeleteError("We couldn’t delete the list. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) {
    return null;
  }

  const lists = listsState.status === "ready" ? listsState.lists : [];
  const showHeaderButton = listsState.status === "loading" || lists.length > 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-text-primary">
      <TopBar name={profile.name} email={profile.email} onSignOut={handleSignOut} />
      <main className="mx-auto box-border flex w-full max-w-[640px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="m-0 text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-text-primary outline-none"
          >
            My lists
          </h1>
          {showHeaderButton && <Button onClick={openCreate}>New list</Button>}
        </div>

        {listsState.status === "loading" && (
          <div>
            <p role="status" className="sr-only">
              Loading your lists
            </p>
            <div className="rounded-lg border border-border bg-surface shadow-1">
              {SKELETON_ROWS.map((i) => (
                <SkeletonRow key={i} index={i} />
              ))}
            </div>
          </div>
        )}

        {listsState.status === "error" && (
          <EmptyState
            tone="error"
            live
            title="We couldn’t load your lists"
            description="Check your internet connection and try again."
          >
            <Button variant="secondary" onClick={handleRetry}>
              Try again
            </Button>
          </EmptyState>
        )}

        {listsState.status === "ready" && lists.length === 0 && (
          <EmptyState title="No lists yet" description="Create a list to start keeping track of things.">
            <Button onClick={openCreate}>New list</Button>
          </EmptyState>
        )}

        {lists.length > 0 && (
          <ul aria-label="Your lists" className="m-0 list-none rounded-lg border border-border bg-surface p-0 shadow-1">
            {lists.map((list) => (
              <li key={list.id} className="group/row">
                <ListRow
                  name={list.name}
                  meta={progressOf(list)}
                  href={`/app/list/?id=${encodeURIComponent(list.id)}`}
                  saving={savingId === list.id}
                  menuTriggerId={menuTriggerId(list.id)}
                  onRename={() => openRename(list)}
                  onDelete={() => openDelete(list)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {(dialog.kind === "create" || dialog.kind === "rename") && (
        <Dialog
          asForm
          title={dialog.kind === "create" ? "New list" : "Rename list"}
          confirmLabel={dialog.kind === "create" ? "Create list" : "Save"}
          loading={submitting}
          loadingLabel={dialog.kind === "create" ? "Creating list" : "Saving name"}
          onConfirm={() => (dialog.kind === "create" ? handleCreate() : handleRename(dialog.list))}
          onCancel={closeDialog}
        >
          <TextField
            ref={nameInputRef}
            id="list-name"
            label="Name"
            placeholder={dialog.kind === "create" ? "e.g. Groceries" : undefined}
            helperText="Up to 60 characters."
            autoComplete="off"
            value={nameValue}
            onChange={handleNameChange}
            readOnly={submitting}
            error={nameError}
          />
        </Dialog>
      )}

      {dialog.kind === "delete" && (
        <Dialog
          destructive
          title={`Delete ‘${dialog.list.name}’?`}
          description={deleteDescriptionOf(dialog.list)}
          confirmLabel="Delete list"
          loading={submitting}
          loadingLabel="Deleting list"
          onConfirm={() => handleDelete(dialog.list)}
          onCancel={closeDialog}
        >
          {deleteError && (
            <p role="alert" className="m-0 text-sm text-error">
              {deleteError}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
