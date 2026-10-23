export const LIST_NAME_MAX_LENGTH = 60;

export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Validates a list name from a request body. Messages match the frontend copy.
 *
 * @param body - Parsed request body
 * @returns The trimmed name, or the message to return with a 400
 */
export function validateListName(body: unknown): Validated<string> {
  const raw = (body as { name?: unknown } | null | undefined)?.name;
  if (raw !== undefined && typeof raw !== "string") {
    return { ok: false, message: "The list name must be text." };
  }
  const name = (raw ?? "").trim();
  if (name.length === 0) {
    return { ok: false, message: "Enter a name for the list." };
  }
  // Count code points, not UTF-16 units, so emoji count as one character like in the UI
  const length = [...name].length;
  if (length > LIST_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep the name to ${LIST_NAME_MAX_LENGTH} characters or fewer. This one has ${length}.`,
    };
  }
  return { ok: true, value: name };
}

export const TASK_TITLE_MAX_LENGTH = 200;

function validateTitle(raw: unknown): Validated<string> {
  if (raw !== undefined && typeof raw !== "string") {
    return { ok: false, message: "The task title must be text." };
  }
  const title = (raw ?? "").trim();
  if (title.length === 0) {
    return { ok: false, message: "Enter a task title." };
  }
  const length = [...title].length;
  if (length > TASK_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep the title to ${TASK_TITLE_MAX_LENGTH} characters or fewer. This one has ${length}.`,
    };
  }
  return { ok: true, value: title };
}

/**
 * Validates the body of a task create. Messages match the frontend copy.
 *
 * @param body - Parsed request body
 * @returns The trimmed title, or the message to return with a 400
 */
export function validateTaskCreate(body: unknown): Validated<string> {
  return validateTitle((body as { title?: unknown } | null | undefined)?.title);
}

export interface TaskChanges {
  title?: string;
  done?: boolean;
}

/**
 * Validates the body of a task update: a new title, a new `done` value, or both.
 *
 * @param body - Parsed request body
 * @returns The changes to apply, or the message to return with a 400
 */
export function validateTaskChanges(body: unknown): Validated<TaskChanges> {
  const input = (body ?? {}) as { title?: unknown; done?: unknown };
  if (typeof input !== "object" || (input.title === undefined && input.done === undefined)) {
    return { ok: false, message: "Send a new title, a done value, or both." };
  }
  const changes: TaskChanges = {};
  if (input.title !== undefined) {
    const title = validateTitle(input.title);
    if (!title.ok) {
      return title;
    }
    changes.title = title.value;
  }
  if (input.done !== undefined) {
    if (typeof input.done !== "boolean") {
      return { ok: false, message: "Done must be true or false." };
    }
    changes.done = input.done;
  }
  return { ok: true, value: changes };
}
