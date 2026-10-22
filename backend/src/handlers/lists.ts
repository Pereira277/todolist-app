import { randomUUID } from "node:crypto";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type BatchGetCommandInput,
  type BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { hasAccess } from "../lib/access.js";
import {
  META_SK,
  db,
  isThrottlingError,
  isUuid,
  listKey,
  tableName,
  userPk,
  withBatchRetries,
} from "../lib/db.js";
import {
  emptyResponse,
  getUserId,
  jsonResponse,
  parseJsonBody,
  type ApiEvent,
  type ApiResult,
} from "../lib/http.js";
import { validateListName } from "../lib/validation.js";

/** List as returned by the API */
export interface List {
  id: string;
  name: string;
  taskCount: number;
  doneCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ListMetaItem extends Omit<List, "id"> {
  PK: string;
  SK: string;
  ownerId: string;
}

type Key = { PK: string; SK: string };

const BATCH_GET_LIMIT = 100;
const BATCH_WRITE_LIMIT = 25;

const notFound = (): ApiResult => jsonResponse(404, { message: "List not found." });

function toList(item: ListMetaItem): List {
  return {
    id: item.PK.slice("LIST#".length),
    name: item.name,
    taskCount: item.taskCount,
    doneCount: item.doneCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function queryKeys(pk: string, skPrefix?: string): Promise<Key[]> {
  const keys: Key[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: skPrefix
          ? "PK = :pk AND begins_with(SK, :sk)"
          : "PK = :pk",
        ExpressionAttributeValues: skPrefix ? { ":pk": pk, ":sk": skPrefix } : { ":pk": pk },
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: startKey,
      })
    );
    keys.push(...((page.Items ?? []) as Key[]));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return keys;
}

async function getListMetas(listIds: string[]): Promise<ListMetaItem[]> {
  const table = tableName();
  const metas: ListMetaItem[] = [];
  for (const ids of chunk(listIds, BATCH_GET_LIMIT)) {
    const request: BatchGetCommandInput["RequestItems"] = {
      [table]: { Keys: ids.map((id) => ({ PK: listKey(id), SK: META_SK })) },
    };
    await withBatchRetries("BatchGetItem", request, async (pending) => {
      const result = await db.send(new BatchGetCommand({ RequestItems: pending }));
      metas.push(...((result.Responses?.[table] ?? []) as ListMetaItem[]));
      const unprocessed = result.UnprocessedKeys;
      return unprocessed && Object.keys(unprocessed).length > 0 ? unprocessed : undefined;
    });
  }
  return metas;
}

async function deleteKeys(keys: Key[]): Promise<void> {
  const table = tableName();
  for (const batch of chunk(keys, BATCH_WRITE_LIMIT)) {
    const request: BatchWriteCommandInput["RequestItems"] = {
      [table]: batch.map((key) => ({ DeleteRequest: { Key: key } })),
    };
    await withBatchRetries("BatchWriteItem", request, async (pending) => {
      const result = await db.send(new BatchWriteCommand({ RequestItems: pending }));
      const unprocessed = result.UnprocessedItems;
      return unprocessed && Object.keys(unprocessed).length > 0 ? unprocessed : undefined;
    });
  }
}

async function listLists(userId: string): Promise<ApiResult> {
  const accessKeys = await queryKeys(userPk(userId), "LIST#");
  const listIds = accessKeys.map((key) => key.SK.slice("LIST#".length));
  // A list being deleted loses its META first, so it simply drops out of the result
  const metas = await getListMetas(listIds);
  const lists = metas
    .map(toList)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return jsonResponse(200, { lists });
}

async function createList(userId: string, event: ApiEvent): Promise<ApiResult> {
  const body = parseJsonBody(event);
  if (!body.ok) {
    return jsonResponse(400, { message: "The request body must be valid JSON." });
  }
  const name = validateListName(body.value);
  if (!name.ok) {
    return jsonResponse(400, { message: name.message });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const meta: ListMetaItem = {
    PK: listKey(id),
    SK: META_SK,
    name: name.value,
    ownerId: userId,
    taskCount: 0,
    doneCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName(),
            Item: meta,
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: tableName(),
            Item: { PK: userPk(userId), SK: listKey(id), role: "owner", createdAt: now },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    })
  );

  return jsonResponse(201, toList(meta));
}

async function renameList(userId: string, listId: string, event: ApiEvent): Promise<ApiResult> {
  const body = parseJsonBody(event);
  if (!body.ok) {
    return jsonResponse(400, { message: "The request body must be valid JSON." });
  }
  const name = validateListName(body.value);
  if (!name.ok) {
    return jsonResponse(400, { message: name.message });
  }
  if (!(await hasAccess(userId, listId))) {
    return notFound();
  }

  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: listKey(listId), SK: META_SK },
        UpdateExpression: "SET #name = :name, updatedAt = :now",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":name": name.value, ":now": new Date().toISOString() },
        ReturnValues: "ALL_NEW",
      })
    );
    return jsonResponse(200, toList(result.Attributes as ListMetaItem));
  } catch (err) {
    // META is gone while the access item remains: a delete is in progress
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return notFound();
    }
    throw err;
  }
}

async function deleteList(userId: string, listId: string): Promise<ApiResult> {
  if (!(await hasAccess(userId, listId))) {
    return notFound();
  }

  // Order matters (ADR-0002): removing META first blocks new task writes and hides the
  // list; the access item goes last, so a failed delete can be retried by the caller
  await db.send(
    new DeleteCommand({ TableName: tableName(), Key: { PK: listKey(listId), SK: META_SK } })
  );
  await deleteKeys(await queryKeys(listKey(listId)));
  await db.send(
    new DeleteCommand({ TableName: tableName(), Key: { PK: userPk(userId), SK: listKey(listId) } })
  );

  return emptyResponse(204);
}

/**
 * Lists API: `GET /lists`, `POST /lists`, `PATCH /lists/{id}` and `DELETE /lists/{id}`.
 *
 * One function serves every list route and dispatches on `routeKey` (ADR-0006). Every
 * route that targets a list checks the caller's access item and answers 404 when it is
 * missing, so other users' lists are indistinguishable from lists that do not exist.
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

  try {
    switch (event.routeKey) {
      case "GET /lists":
        return await listLists(userId);
      case "POST /lists":
        return await createList(userId, event);
      case "PATCH /lists/{id}":
        return isUuid(listId) ? await renameList(userId, listId, event) : notFound();
      case "DELETE /lists/{id}":
        return isUuid(listId) ? await deleteList(userId, listId) : notFound();
      default:
        return jsonResponse(404, { message: "Not found." });
    }
  } catch (err) {
    if (isThrottlingError(err)) {
      console.warn(JSON.stringify({ level: "warn", message: "DynamoDB throttled", routeKey: event.routeKey }));
      return jsonResponse(
        503,
        { message: "The service is busy. Try again in a moment." },
        { "Retry-After": "1" }
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        message: "Unhandled error",
        routeKey: event.routeKey,
        error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      })
    );
    return jsonResponse(500, { message: "Something went wrong." });
  }
}
