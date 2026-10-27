"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, type FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DeleteListDialog } from "@/components/DeleteListDialog";
import { ListNameDialog } from "@/components/ListNameDialog";
import { TopBar } from "@/components/TopBar";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { SkeletonRow, skeletonBar } from "@/components/ui/SkeletonRow";
import { TaskRow, taskCheckId, taskDeleteId, taskTitleId } from "@/components/ui/TaskRow";
import { TextField } from "@/components/ui/TextField";
import {
  createTask,
  deleteList,
  deleteTask,
  fetchListWithTasks,
  renameList,
  updateTask,
  type List,
  type Task,
} from "@/lib/api";
import { DELETE_LIST_ERROR, isNotFound, progressText, saveErrorMessage } from "@/lib/lists";
import { useProfile } from "@/lib/useProfile";
import { isUuid, listNameError, taskTitleError } from "@/lib/validate";

type PageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "not-found" }
  | { status: "ready"; list: List; tasks: Task[] };

type Editing = { taskId: string; draft: string; error?: string };

type DialogKind = "none" | "rename" | "delete";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

const ADD_INPUT_ID = "new-task";

/**
 * List detail page at /app/list/?id=<id>. The id comes from the query string
 * so a single static page serves every list.
 *
 * @returns The page, client-rendered once the query string is known
 */
export default function ListDetailPage() {
  // useSearchParams needs a Suspense boundary in a static export
  return (
    <Suspense fallback={null}>
      <ListDetailRoute />
    </Suspense>
  );
}

function ListDetailRoute() {
  const id = useSearchParams().get("id");
  // A new id starts from a clean state instead of showing the previous list
  return <ListDetail key={id ?? ""} listId={isUuid(id) ? id : null} />;
}

function ListDetail({ listId }: { listId: string | null }) {
  const router = useRouter();
  const { profile, handleSignOut } = useProfile();
  // A missing or malformed id cannot match any list, so the API is not called
  const [state, setState] = useState<PageState>(listId ? { status: "loading" } : { status: "not-found" });
  const [attempt, setAttempt] = useState(0);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [taskError, setTaskError] = useState<string>();
  const [dialog, setDialog] = useState<DialogKind>("none");
  const [nameValue, setNameValue] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
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
    if (!listId) return;
    let cancelled = false;
    fetchListWithTasks(listId)
      .then(({ list, tasks }) => {
        if (!cancelled) setState({ status: "ready", list, tasks });
      })
      .catch((err) => {
        if (!cancelled) setState(isNotFound(err) ? { status: "not-found" } : { status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [listId, attempt]);

  const updateTasks = useCallback((update: (tasks: Task[]) => Task[]) => {
    setState((s) => (s.status === "ready" ? { ...s, tasks: update(s.tasks) } : s));
  }, []);

  const replaceTask = useCallback(
    (task: Task) => updateTasks((tasks) => tasks.map((t) => (t.id === task.id ? task : t))),
    [updateTasks]
  );

  function setPending(taskId: string, pending: boolean) {
    setPendingIds((ids) => {
      const next = new Set(ids);
      if (pending) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  // A 404 on a task means the task or the whole list is gone; reloading tells which
  function reloadAfterNotFound() {
    setAttempt((n) => n + 1);
  }

  function handleRetry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!listId || adding) return;
    const error = taskTitleError(addValue);
    if (error) {
      setAddError(error);
      return;
    }
    setAddError(undefined);
    setTaskError(undefined);
    setAdding(true);
    try {
      const task = await createTask(listId, addValue.trim());
      updateTasks((tasks) => [task, ...tasks]);
      setAddValue("");
    } catch (err) {
      if (isNotFound(err)) {
        reloadAfterNotFound();
        return;
      }
      setAddError(saveErrorMessage(err, "We couldn’t add the task. Try again."));
    } finally {
      setAdding(false);
      // The field is disabled while adding, which drops its focus
      pendingFocus.current = () => document.getElementById(ADD_INPUT_ID);
    }
  }

  async function handleToggle(task: Task) {
    if (!listId || pendingIds.has(task.id)) return;
    setTaskError(undefined);
    setPending(task.id, true);
    replaceTask({ ...task, done: !task.done });
    try {
      replaceTask(await updateTask(listId, task.id, { done: !task.done }));
    } catch (err) {
      if (isNotFound(err)) {
        reloadAfterNotFound();
        return;
      }
      replaceTask(task);
      setTaskError("We couldn’t update the task. Try again.");
    } finally {
      setPending(task.id, false);
      // The checkbox is disabled while saving, which drops its focus
      pendingFocus.current = () => enabledById(taskCheckId(task.id));
    }
  }

  async function handleDeleteTask(task: Task, neighborId: string | undefined) {
    if (!listId || pendingIds.has(task.id)) return;
    setTaskError(undefined);
    setPending(task.id, true);
    try {
      await deleteTask(listId, task.id);
      updateTasks((tasks) => tasks.filter((t) => t.id !== task.id));
      // The row is gone; continue from the next task, or the add field when it was the last one
      pendingFocus.current = () =>
        (neighborId && document.getElementById(taskTitleId(neighborId))) || document.getElementById(ADD_INPUT_ID);
    } catch (err) {
      if (isNotFound(err)) {
        reloadAfterNotFound();
        return;
      }
      setTaskError("We couldn’t delete the task. Try again.");
      pendingFocus.current = () => enabledById(taskDeleteId(task.id));
    } finally {
      setPending(task.id, false);
    }
  }

  // Controls are disabled while their task saves, so focus waits until they are enabled again
  function enabledById(id: string) {
    const control = document.getElementById(id) as HTMLButtonElement | HTMLInputElement | null;
    return control && !control.disabled ? control : null;
  }

  function startEdit(task: Task) {
    setTaskError(undefined);
    setEditing({ taskId: task.id, draft: task.title });
    pendingFocus.current = () => editInputRef.current;
  }

  function cancelEdit() {
    if (!editing) return;
    const { taskId } = editing;
    setEditing(null);
    pendingFocus.current = () => enabledById(taskTitleId(taskId));
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>) {
    const draft = event.target.value;
    setEditing((e) => (e ? { taskId: e.taskId, draft } : e));
  }

  async function saveEdit(task: Task) {
    if (!listId || !editing || pendingIds.has(task.id)) return;
    const error = taskTitleError(editing.draft);
    if (error) {
      setEditing({ ...editing, error });
      editInputRef.current?.focus();
      return;
    }
    const title = editing.draft.trim();
    if (title === task.title) {
      cancelEdit();
      return;
    }
    setPending(task.id, true);
    try {
      replaceTask(await updateTask(listId, task.id, { title }));
      setEditing(null);
      pendingFocus.current = () => enabledById(taskTitleId(task.id));
    } catch (err) {
      if (isNotFound(err)) {
        setEditing(null);
        reloadAfterNotFound();
        return;
      }
      setEditing({ taskId: task.id, draft: editing.draft, error: saveErrorMessage(err, "We couldn’t save the task. Try again.") });
      pendingFocus.current = () => editInputRef.current;
    } finally {
      setPending(task.id, false);
    }
  }

  function openRename(list: List) {
    setNameValue(list.name);
    setNameError(undefined);
    setDialog("rename");
  }

  function openDelete() {
    setDeleteError(undefined);
    setDialog("delete");
  }

  function closeDialog() {
    setDialog("none");
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setNameValue(event.target.value);
    if (nameError) setNameError(undefined);
  }

  async function handleRename(list: List) {
    const error = listNameError(nameValue);
    if (error) {
      setNameError(error);
      nameInputRef.current?.focus();
      return;
    }
    const name = nameValue.trim();
    if (name === list.name) {
      closeDialog();
      return;
    }
    setSubmitting(true);
    try {
      const saved = await renameList(list.id, name);
      setState((s) => (s.status === "ready" ? { ...s, list: { ...s.list, name: saved.name } } : s));
      closeDialog();
    } catch (err) {
      if (isNotFound(err)) {
        closeDialog();
        setState({ status: "not-found" });
        return;
      }
      setNameError(saveErrorMessage(err, "We couldn’t save the name. Try again."));
      pendingFocus.current = () => nameInputRef.current;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteList(list: List) {
    setDeleteError(undefined);
    setSubmitting(true);
    try {
      await deleteList(list.id);
      router.push("/app/");
    } catch (err) {
      // A 404 on the first attempt means the list was already gone
      if (isNotFound(err)) {
        router.push("/app/");
        return;
      }
      setDeleteError(DELETE_LIST_ERROR);
      setSubmitting(false);
    }
  }

  if (!profile) {
    return null;
  }

  const ready = state.status === "ready" ? state : null;
  const doneCount = ready ? ready.tasks.filter((t) => t.done).length : 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-text-primary">
      <TopBar name={profile.name} email={profile.email} onSignOut={handleSignOut} />
      <main className="mx-auto box-border flex w-full max-w-[640px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        {state.status !== "not-found" && (
          <Link
            href="/app/"
            className="-mt-3 -mb-4 -ml-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-md pr-2 text-sm leading-5 font-medium text-primary no-underline hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            <Icon name="back" />
            My lists
          </Link>
        )}

        {state.status === "loading" && (
          <div aria-hidden="true" className="flex flex-col gap-3 pt-1 pb-0.5">
            <span className={`${skeletonBar} h-[30px] w-[220px] max-w-full`} />
            <span className={`${skeletonBar} h-3 w-24`} />
          </div>
        )}

        {ready && (
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="m-0 text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-text-primary [overflow-wrap:anywhere]">
                {ready.list.name}
              </h1>
              <p className="m-0 text-sm leading-5 text-text-secondary">{progressText(ready.tasks.length, doneCount)}</p>
            </div>
            <ActionMenu
              label={`Actions for ${ready.list.name}`}
              items={[
                { label: "Rename", icon: "pencil", onSelect: () => openRename(ready.list) },
                { label: "Delete", icon: "trash", destructive: true, onSelect: openDelete },
              ]}
            />
          </div>
        )}

        {(state.status === "loading" || ready) && (
          <form aria-label="Add a task" noValidate onSubmit={handleAdd} className="m-0 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                id={ADD_INPUT_ID}
                label="Add a task"
                placeholder="What needs doing?"
                autoComplete="off"
                value={addValue}
                onChange={(event) => {
                  setAddValue(event.target.value);
                  if (addError) setAddError(undefined);
                }}
                disabled={!ready || adding}
                error={addError}
              />
            </div>
            <div className="flex-none pt-7">
              <Button type="submit" loading={adding} loadingLabel="Adding task" disabled={!ready}>
                Add
              </Button>
            </div>
          </form>
        )}

        {taskError && (
          <p role="alert" className="m-0 flex items-start gap-1 text-sm text-error">
            <span className="mt-0.5">
              <Icon name="error" size={16} />
            </span>
            <span>{taskError}</span>
          </p>
        )}

        {state.status === "loading" && (
          <div>
            <p role="status" className="sr-only">
              Loading tasks
            </p>
            <div className="rounded-lg border border-border bg-surface shadow-1">
              {SKELETON_ROWS.map((i) => (
                <SkeletonRow key={i} index={i} variant="task" />
              ))}
            </div>
          </div>
        )}

        {ready && ready.tasks.length > 0 && (
          <ul aria-label="Tasks" className="m-0 list-none rounded-lg border border-border bg-surface p-0 shadow-1">
            {ready.tasks.map((task, index) => {
              const isEditing = editing?.taskId === task.id;
              const neighbor = ready.tasks[index + 1] ?? ready.tasks[index - 1];
              return (
                <li key={task.id} className="group/row">
                  <TaskRow
                    task={task}
                    saving={pendingIds.has(task.id)}
                    editing={isEditing}
                    draft={isEditing ? editing.draft : undefined}
                    error={isEditing ? editing.error : undefined}
                    inputRef={isEditing ? editInputRef : undefined}
                    onToggle={() => handleToggle(task)}
                    onEdit={() => startEdit(task)}
                    onDraftChange={handleDraftChange}
                    onSave={() => saveEdit(task)}
                    onCancel={cancelEdit}
                    onDelete={() => handleDeleteTask(task, neighbor?.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {ready && ready.tasks.length === 0 && (
          <EmptyState
            icon="tasks"
            title="No tasks yet"
            description="Add your first task with the field above. You can tick it off when it’s done."
          />
        )}

        {state.status === "error" && (
          <EmptyState
            tone="error"
            live
            title="We couldn’t load this list"
            description="Check your internet connection and try again."
          >
            <Button variant="secondary" onClick={handleRetry}>
              Try again
            </Button>
          </EmptyState>
        )}

        {state.status === "not-found" && (
          <EmptyState
            icon="question"
            headingLevel={1}
            title="This list doesn’t exist or you don’t have access to it"
            description="It may have been deleted, or the link may be wrong."
          >
            <Link
              href="/app/"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium whitespace-nowrap text-on-primary no-underline transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Back to My lists
            </Link>
          </EmptyState>
        )}
      </main>

      {ready && dialog === "rename" && (
        <ListNameDialog
          mode="rename"
          value={nameValue}
          error={nameError}
          saving={submitting}
          inputRef={nameInputRef}
          onChange={handleNameChange}
          onConfirm={() => handleRename(ready.list)}
          onCancel={closeDialog}
        />
      )}

      {ready && dialog === "delete" && (
        <DeleteListDialog
          list={{ name: ready.list.name, taskCount: ready.tasks.length }}
          deleting={submitting}
          error={deleteError}
          onConfirm={() => handleDeleteList(ready.list)}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
