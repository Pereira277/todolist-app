const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export const INVALID_EMAIL_MESSAGE = "Enter a valid email address, like name@example.com.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks an id from the URL before calling the API with it.
 *
 * @param value - Id as read from the query string
 * @returns True when the value is a UUID, the format the API uses for ids
 */
export function isUuid(value: string | null): value is string {
  return value !== null && UUID_RE.test(value);
}

export const LIST_NAME_MAX_LENGTH = 60;
export const TASK_TITLE_MAX_LENGTH = 200;

// Count code points, not UTF-16 units, so emoji count as one character like in the API
const lengthOf = (value: string) => [...value].length;

/**
 * Validates a list name with the same rules and messages as the API.
 *
 * @param value - Name as typed
 * @returns The error message to show, or undefined when the name is valid
 */
export function listNameError(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) {
    return "Enter a name for the list.";
  }
  const length = lengthOf(name);
  if (length > LIST_NAME_MAX_LENGTH) {
    return `Keep the name to ${LIST_NAME_MAX_LENGTH} characters or fewer. This one has ${length}.`;
  }
  return undefined;
}

/**
 * Validates a task title with the same rules and messages as the API.
 *
 * @param value - Title as typed
 * @returns The error message to show, or undefined when the title is valid
 */
export function taskTitleError(value: string): string | undefined {
  const title = value.trim();
  if (title.length === 0) {
    return "Enter a task title.";
  }
  const length = lengthOf(title);
  if (length > TASK_TITLE_MAX_LENGTH) {
    return `Keep the title to ${TASK_TITLE_MAX_LENGTH} characters or fewer. This one has ${length}.`;
  }
  return undefined;
}
