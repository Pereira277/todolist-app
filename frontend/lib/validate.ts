const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export const INVALID_EMAIL_MESSAGE = "Enter a valid email address, like name@example.com.";

export const LIST_NAME_MAX_LENGTH = 60;

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
  // Count code points, not UTF-16 units, so emoji count as one character like in the API
  const length = [...name].length;
  if (length > LIST_NAME_MAX_LENGTH) {
    return `Keep the name to ${LIST_NAME_MAX_LENGTH} characters or fewer. This one has ${length}.`;
  }
  return undefined;
}
