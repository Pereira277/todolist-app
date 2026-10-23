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
