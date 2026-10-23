/** List as returned by the API */
export interface List {
  id: string;
  name: string;
  taskCount: number;
  doneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListMetaItem extends Omit<List, "id"> {
  PK: string;
  SK: string;
  ownerId: string;
}

/** Task as returned by the API */
export interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem extends Omit<Task, "id"> {
  PK: string;
  SK: string;
}

export const TASK_SK_PREFIX = "TASK#";

/**
 * @param taskId - Task UUID
 * @returns Sort key of the task inside its list partition
 */
export function taskSk(taskId: string): string {
  return `${TASK_SK_PREFIX}${taskId}`;
}

/**
 * Maps a `META` item to the API shape.
 *
 * @param item - List `META` item
 * @returns The list without key attributes
 */
export function toList(item: ListMetaItem): List {
  return {
    id: item.PK.slice("LIST#".length),
    name: item.name,
    taskCount: item.taskCount,
    doneCount: item.doneCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Maps a task item to the API shape.
 *
 * @param item - Task item
 * @returns The task without key attributes
 */
export function toTask(item: TaskItem): Task {
  return {
    id: item.SK.slice(TASK_SK_PREFIX.length),
    title: item.title,
    done: item.done,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Sorts newest first, the order of both My lists and a list's tasks (ADR-0006).
 *
 * @param a - First item
 * @param b - Second item
 * @returns Comparator result for `Array.prototype.sort`
 */
export function newestFirst(a: { createdAt: string }, b: { createdAt: string }): number {
  return b.createdAt.localeCompare(a.createdAt);
}
