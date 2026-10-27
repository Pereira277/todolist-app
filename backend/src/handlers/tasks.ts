import { randomUUID } from "node:crypto";
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { hasAccess } from "../lib/access.js";
import { META_SK, db, failedConditionAt, isUuid, listKey, tableName } from "../lib/db.js";
import { errorResponse } from "../lib/errors.js";
import {
  emptyResponse,
  getUserId,
  jsonResponse,
  parseJsonBody,
  type ApiEvent,
  type ApiResult,
} from "../lib/http.js";
import {
  TASK_SK_PREFIX,
  newestFirst,
  taskSk,
  toList,
  toTask,
  type ListMetaItem,
  type TaskItem,
} from "../lib/models.js";
import { validateTaskChanges, validateTaskCreate, type TaskChanges } from "../lib/validation.js";

type TransactItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];

// The task item is always first and META second in every transaction below
const TASK_INDEX = 0;
const META_INDEX = 1;

// A conflicting write between our read and our transaction is rare, so a couple of rereads is enough
const MAX_ATTEMPTS = 3;

const listNotFound = (): ApiResult => jsonResponse(404, { message: "List not found." });
const taskNotFound = (): ApiResult => jsonResponse(404, { message: "Task not found." });
const invalidJson = (): ApiResult =>
  jsonResponse(400, { message: "The request body must be valid JSON." });

/** Raised when the task kept changing between the read and the transaction */
class TaskConflictError extends Error {
  constructor() {
    super(`Task changed during ${MAX_ATTEMPTS} attempts`);
    this.name = "TaskConflictError";
  }
}

function metaUpdate(listId: string, taskDelta: number, doneDelta: number): TransactItem {
  return {
    Update: {
      TableName: tableName(),
      Key: { PK: listKey(listId), SK: META_SK },
      UpdateExpression: "ADD taskCount :tasks, doneCount :done",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":tasks": taskDelta, ":done": doneDelta },
    },
  };
}

function isConditionalCheckFailure(err: unknown): boolean {
  return err instanceof Error && err.name === "ConditionalCheckFailedException";
}

async function getTask(listId: string, taskId: string): Promise<TaskItem | undefined> {
  const result = await db.send(
    new GetCommand({ TableName: tableName(), Key: { PK: listKey(listId), SK: taskSk(taskId) } })
  );
  return result.Item as TaskItem | undefined;
}

async function getListWithTasks(listId: string): Promise<ApiResult> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": listKey(listId) },
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  const meta = items.find((item) => item.SK === META_SK) as ListMetaItem | undefined;
  // The access item outlives META while a list is being deleted (ADR-0002)
  if (!meta) {
    return listNotFound();
  }
  const tasks = items
    .filter((item) => typeof item.SK === "string" && item.SK.startsWith(TASK_SK_PREFIX))
    .map((item) => toTask(item as unknown as TaskItem))
    .sort(newestFirst);
  return jsonResponse(200, { list: toList(meta), tasks });
}

async function createTask(listId: string, title: string): Promise<ApiResult> {
  const now = new Date().toISOString();
  const task: TaskItem = {
    PK: listKey(listId),
    SK: taskSk(randomUUID()),
    title,
    done: false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: task,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          metaUpdate(listId, 1, 0),
        ],
      })
    );
  } catch (err) {
    if (failedConditionAt(err, META_INDEX)) {
      return listNotFound();
    }
    throw err;
  }
  return jsonResponse(201, toTask(task));
}

async function updateTask(listId: string, taskId: string, changes: TaskChanges): Promise<ApiResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await getTask(listId, taskId);
    if (!current) {
      return taskNotFound();
    }
    const toggles = changes.done !== undefined && changes.done !== current.done;
    if (!toggles && (changes.title === undefined || changes.title === current.title)) {
      return jsonResponse(200, toTask(current));
    }

    const now = new Date().toISOString();
    const names: Record<string, string> = { "#done": "done" };
    const values: Record<string, unknown> = { ":current": current.done, ":now": now };
    const sets = ["updatedAt = :now"];
    if (changes.title !== undefined) {
      sets.push("title = :title");
      values[":title"] = changes.title;
    }
    if (toggles) {
      sets.push("#done = :done");
      values[":done"] = changes.done;
    }
    // Checking the done value we read keeps doneCount exact under concurrent toggles
    const taskUpdate: TransactItem = {
      Update: {
        TableName: tableName(),
        Key: { PK: listKey(listId), SK: taskSk(taskId) },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(PK) AND #done = :current",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      },
    };

    try {
      if (toggles) {
        await db.send(
          new TransactWriteCommand({
            TransactItems: [taskUpdate, metaUpdate(listId, 0, changes.done ? 1 : -1)],
          })
        );
      } else {
        // A title edit leaves the counters alone, so it only touches the task (ADR-0002)
        await db.send(new UpdateCommand(taskUpdate.Update!));
      }
    } catch (err) {
      if (failedConditionAt(err, META_INDEX)) {
        return listNotFound();
      }
      if (failedConditionAt(err, TASK_INDEX) || isConditionalCheckFailure(err)) {
        continue;
      }
      throw err;
    }

    return jsonResponse(
      200,
      toTask({
        ...current,
        title: changes.title ?? current.title,
        done: changes.done ?? current.done,
        updatedAt: now,
      })
    );
  }
  throw new TaskConflictError();
}

async function deleteTask(listId: string, taskId: string): Promise<ApiResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await getTask(listId, taskId);
    if (!current) {
      return taskNotFound();
    }

    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: tableName(),
                Key: { PK: listKey(listId), SK: taskSk(taskId) },
                ConditionExpression: "attribute_exists(PK) AND #done = :current",
                ExpressionAttributeNames: { "#done": "done" },
                ExpressionAttributeValues: { ":current": current.done },
              },
            },
            metaUpdate(listId, -1, current.done ? -1 : 0),
          ],
        })
      );
    } catch (err) {
      if (failedConditionAt(err, META_INDEX)) {
        return listNotFound();
      }
      if (failedConditionAt(err, TASK_INDEX)) {
        continue;
      }
      throw err;
    }
    return emptyResponse(204);
  }
  throw new TaskConflictError();
}

/**
 * Tasks API: `GET/POST /lists/{id}/tasks` and `PATCH/DELETE /lists/{id}/tasks/{taskId}`.
 *
 * One function serves every task route and dispatches on `routeKey` (ADR-0006). Access is
 * checked like in the lists API: a list the caller cannot see answers 404. Writes that
 * change progress run in a transaction with the `META` counters, whose condition also
 * rejects writes to a list that is being deleted (ADR-0002).
 *
 * @param event - HTTP API event, already authenticated by the Cognito JWT authorizer
 * @returns JSON response; 503 with `Retry-After` when DynamoDB throttles the request
 */
export async function handler(event: ApiEvent): Promise<ApiResult> {
  const userId = getUserId(event);
  if (!userId) {
    return jsonResponse(401, { message: "Unauthorized" });
  }

  const listId = event.pathParameters?.id;
  const taskId = event.pathParameters?.taskId;

  try {
    switch (event.routeKey) {
      case "GET /lists/{id}/tasks":
        if (!isUuid(listId) || !(await hasAccess(userId, listId))) {
          return listNotFound();
        }
        return await getListWithTasks(listId);
      case "POST /lists/{id}/tasks": {
        if (!isUuid(listId)) {
          return listNotFound();
        }
        const body = parseJsonBody(event);
        if (!body.ok) {
          return invalidJson();
        }
        const title = validateTaskCreate(body.value);
        if (!title.ok) {
          return jsonResponse(400, { message: title.message });
        }
        if (!(await hasAccess(userId, listId))) {
          return listNotFound();
        }
        return await createTask(listId, title.value);
      }
      case "PATCH /lists/{id}/tasks/{taskId}": {
        if (!isUuid(listId)) {
          return listNotFound();
        }
        if (!isUuid(taskId)) {
          return taskNotFound();
        }
        const body = parseJsonBody(event);
        if (!body.ok) {
          return invalidJson();
        }
        const changes = validateTaskChanges(body.value);
        if (!changes.ok) {
          return jsonResponse(400, { message: changes.message });
        }
        if (!(await hasAccess(userId, listId))) {
          return listNotFound();
        }
        return await updateTask(listId, taskId, changes.value);
      }
      case "DELETE /lists/{id}/tasks/{taskId}":
        if (!isUuid(listId)) {
          return listNotFound();
        }
        if (!isUuid(taskId)) {
          return taskNotFound();
        }
        if (!(await hasAccess(userId, listId))) {
          return listNotFound();
        }
        return await deleteTask(listId, taskId);
      default:
        return jsonResponse(404, { message: "Not found." });
    }
  } catch (err) {
    return errorResponse(err, event.routeKey);
  }
}
