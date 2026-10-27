import { ApiError } from "@/lib/api";

/**
 * @param taskCount - Tasks in the list
 * @param doneCount - Tasks marked done
 * @returns Progress line shown under a list name
 */
export function progressText(taskCount: number, doneCount: number): string {
  if (taskCount === 0) return "No tasks yet";
  if (doneCount === taskCount) return `All ${taskCount} done`;
  return `${doneCount} of ${taskCount} done`;
}

/**
 * @param taskCount - Tasks in the list
 * @returns Warning for the delete dialog, or undefined when there is nothing else to lose
 */
export function deleteListDescription(taskCount: number): string | undefined {
  if (taskCount === 0) return undefined;
  return `This also deletes its ${taskCount} ${taskCount === 1 ? "task" : "tasks"}.`;
}

/**
 * Picks the message to show after a failed save. A 400 carries a message
 * written for the user; anything else gets the generic one.
 *
 * @param err - Error thrown by the API client
 * @param fallback - Message for every other failure
 * @returns The message to show
 */
export function saveErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.status === 400 ? err.message : fallback;
}

/**
 * @param err - Error thrown by the API client
 * @returns True when the API answered 404
 */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export const DELETE_LIST_ERROR = "We couldn’t delete the list. Check your connection and try again.";
