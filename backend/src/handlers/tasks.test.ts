import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { handler } from "./tasks.js";

const ddb = mockClient(DynamoDBDocumentClient);

const USER = "user-1";
const LIST_ID = "0b7f1a52-3c1e-4d8e-9a4f-2f6d1c9e8b10";
const TASK_ID = "6a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const ACCESS_KEY = { PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` };
const TASK_KEY = { PK: `LIST#${LIST_ID}`, SK: `TASK#${TASK_ID}` };

function event(
  routeKey: string,
  options: { id?: string; taskId?: string; body?: unknown; rawBody?: string; sub?: string | null } = {}
) {
  const sub = options.sub === undefined ? USER : options.sub;
  return {
    routeKey,
    pathParameters: { id: options.id ?? LIST_ID, taskId: options.taskId ?? TASK_ID },
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    isBase64Encoded: false,
    requestContext: {
      authorizer: sub ? { jwt: { claims: { sub }, scopes: null } } : undefined,
    },
  } as unknown as Parameters<typeof handler>[0];
}

const META = {
  PK: `LIST#${LIST_ID}`,
  SK: "META",
  name: "Groceries",
  ownerId: USER,
  taskCount: 2,
  doneCount: 1,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

function task(id: string, title: string, done: boolean, createdAt: string) {
  return { PK: `LIST#${LIST_ID}`, SK: `TASK#${id}`, title, done, createdAt, updatedAt: createdAt };
}

function body(result: Awaited<ReturnType<typeof handler>>) {
  return JSON.parse(result.body as string);
}

function cancelled(...codes: string[]) {
  return Object.assign(new Error("cancelled"), {
    name: "TransactionCanceledException",
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
}

function withAccess() {
  ddb.on(GetCommand, { Key: ACCESS_KEY }).resolves({ Item: { PK: ACCESS_KEY.PK } });
}

function withTask(done: boolean) {
  ddb.on(GetCommand, { Key: TASK_KEY }).resolves({
    Item: task(TASK_ID, "Milk", done, "2026-10-02T10:00:00.000Z"),
  });
}

beforeEach(() => {
  ddb.reset();
  process.env.TABLE_NAME = "todolist";
});

describe("tasks handler", () => {
  it("returns 401 without JWT claims", async () => {
    const result = await handler(event("GET /lists/{id}/tasks", { sub: null }));
    expect(result.statusCode).toBe(401);
  });

  it.each([
    "GET /lists/{id}/tasks",
    "POST /lists/{id}/tasks",
    "PATCH /lists/{id}/tasks/{taskId}",
    "DELETE /lists/{id}/tasks/{taskId}",
  ])("%s returns 404 for another user's list", async (routeKey) => {
    ddb.on(GetCommand).resolves({});

    const result = await handler(event(routeKey, { body: { title: "Milk", done: true } }));

    expect(result.statusCode).toBe(404);
    expect(body(result).message).toBe("List not found.");
    expect(ddb.commandCalls(GetCommand)).toHaveLength(1);
    expect(ddb.calls()).toHaveLength(1);
  });

  it.each([
    ["GET /lists/{id}/tasks", { id: "not-a-uuid" }],
    ["PATCH /lists/{id}/tasks/{taskId}", { taskId: "not-a-uuid" }],
    ["DELETE /lists/{id}/tasks/{taskId}", { taskId: "not-a-uuid" }],
  ])("%s returns 404 for a non-UUID id without calling DynamoDB", async (routeKey, ids) => {
    const result = await handler(event(routeKey, { ...ids, body: { done: true } }));

    expect(result.statusCode).toBe(404);
    expect(ddb.calls()).toHaveLength(0);
  });

  describe("GET /lists/{id}/tasks", () => {
    it("returns the list and its tasks newest first from a single Query", async () => {
      withAccess();
      ddb.on(QueryCommand).resolves({
        Items: [
          META,
          task("a", "Milk", true, "2026-10-02T10:00:00.000Z"),
          task("b", "Bread", false, "2026-10-03T10:00:00.000Z"),
        ],
      });

      const result = await handler(event("GET /lists/{id}/tasks"));

      expect(result.statusCode).toBe(200);
      expect(body(result)).toEqual({
        list: {
          id: LIST_ID,
          name: "Groceries",
          taskCount: 2,
          doneCount: 1,
          createdAt: META.createdAt,
          updatedAt: META.updatedAt,
        },
        tasks: [
          { id: "b", title: "Bread", done: false, createdAt: "2026-10-03T10:00:00.000Z", updatedAt: "2026-10-03T10:00:00.000Z" },
          { id: "a", title: "Milk", done: true, createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z" },
        ],
      });
      expect(ddb.commandCalls(QueryCommand)).toHaveLength(1);
      expect(ddb.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `LIST#${LIST_ID}` },
      });
    });

    it("returns 404 when the access item exists but META is gone (list mid-delete)", async () => {
      withAccess();
      ddb.on(QueryCommand).resolves({ Items: [task("a", "Milk", false, "2026-10-02T10:00:00.000Z")] });

      const result = await handler(event("GET /lists/{id}/tasks"));

      expect(result.statusCode).toBe(404);
      expect(body(result).message).toBe("List not found.");
    });

    it("follows Query pagination", async () => {
      withAccess();
      ddb
        .on(QueryCommand)
        .resolvesOnce({ Items: [META], LastEvaluatedKey: { PK: META.PK, SK: "META" } })
        .resolves({ Items: [task("a", "Milk", false, "2026-10-02T10:00:00.000Z")] });

      const result = await handler(event("GET /lists/{id}/tasks"));

      expect(body(result).tasks).toHaveLength(1);
      expect(ddb.commandCalls(QueryCommand)[1].args[0].input.ExclusiveStartKey).toEqual({
        PK: META.PK,
        SK: "META",
      });
    });
  });

  describe("POST /lists/{id}/tasks", () => {
    it("creates the task and increments taskCount in one transaction", async () => {
      withAccess();
      ddb.on(TransactWriteCommand).resolves({});

      const result = await handler(event("POST /lists/{id}/tasks", { body: { title: "  Milk  " } }));

      expect(result.statusCode).toBe(201);
      const created = body(result);
      expect(created).toMatchObject({ title: "Milk", done: false });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

      const items = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
      expect(items).toHaveLength(2);
      expect(items[0].Put?.Item).toMatchObject({
        PK: `LIST#${LIST_ID}`,
        SK: `TASK#${created.id}`,
        title: "Milk",
        done: false,
      });
      expect(items[1].Update).toMatchObject({
        Key: { PK: `LIST#${LIST_ID}`, SK: "META" },
        UpdateExpression: "ADD taskCount :tasks, doneCount :done",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: { ":tasks": 1, ":done": 0 },
      });
    });

    it.each([
      [{}, "Enter a task title."],
      [{ title: "   " }, "Enter a task title."],
      [{ title: 42 }, "The task title must be text."],
      [{ title: "x".repeat(201) }, "Keep the title to 200 characters or fewer. This one has 201."],
    ])("rejects %j with 400 without calling DynamoDB", async (input, message) => {
      const result = await handler(event("POST /lists/{id}/tasks", { body: input }));

      expect(result.statusCode).toBe(400);
      expect(body(result).message).toBe(message);
      expect(ddb.calls()).toHaveLength(0);
    });

    it("rejects a body that is not JSON with 400", async () => {
      const result = await handler(event("POST /lists/{id}/tasks", { rawBody: "{" }));

      expect(result.statusCode).toBe(400);
    });

    it("returns 404 when META is gone", async () => {
      withAccess();
      ddb.on(TransactWriteCommand).rejects(cancelled("None", "ConditionalCheckFailed"));

      const result = await handler(event("POST /lists/{id}/tasks", { body: { title: "Milk" } }));

      expect(result.statusCode).toBe(404);
      expect(body(result).message).toBe("List not found.");
    });
  });

  describe("PATCH /lists/{id}/tasks/{taskId}", () => {
    it.each([
      [false, true, 1],
      [true, false, -1],
    ])("changes done from %s to %s with doneCount %i in one transaction", async (from, to, delta) => {
      withAccess();
      withTask(from);
      ddb.on(TransactWriteCommand).resolves({});

      const result = await handler(event("PATCH /lists/{id}/tasks/{taskId}", { body: { done: to } }));

      expect(result.statusCode).toBe(200);
      expect(body(result)).toMatchObject({ id: TASK_ID, title: "Milk", done: to });
      const items = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
      expect(items[0].Update).toMatchObject({
        Key: TASK_KEY,
        ConditionExpression: "attribute_exists(PK) AND #done = :current",
        ExpressionAttributeValues: { ":current": from, ":done": to },
      });
      expect(items[1].Update?.ExpressionAttributeValues).toEqual({ ":tasks": 0, ":done": delta });
    });

    it("renames with a single UpdateItem on the task only", async () => {
      withAccess();
      withTask(false);
      ddb.on(UpdateCommand).resolves({});

      const result = await handler(
        event("PATCH /lists/{id}/tasks/{taskId}", { body: { title: " Oat milk " } })
      );

      expect(result.statusCode).toBe(200);
      expect(body(result)).toMatchObject({ title: "Oat milk", done: false });
      expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
      expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
        Key: TASK_KEY,
        UpdateExpression: "SET updatedAt = :now, title = :title",
      });
    });

    it("updates title and done together in the transaction", async () => {
      withAccess();
      withTask(false);
      ddb.on(TransactWriteCommand).resolves({});

      const result = await handler(
        event("PATCH /lists/{id}/tasks/{taskId}", { body: { title: "Oat milk", done: true } })
      );

      expect(body(result)).toMatchObject({ title: "Oat milk", done: true });
      const items = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
      expect(items[0].Update?.UpdateExpression).toBe("SET updatedAt = :now, title = :title, #done = :done");
    });

    it("writes nothing when the task already has the requested values", async () => {
      withAccess();
      withTask(true);

      const result = await handler(
        event("PATCH /lists/{id}/tasks/{taskId}", { body: { title: "Milk", done: true } })
      );

      expect(result.statusCode).toBe(200);
      expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
      expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
    });

    it("rereads and retries when the task changed after it was read", async () => {
      withAccess();
      ddb
        .on(GetCommand, { Key: TASK_KEY })
        .resolvesOnce({ Item: task(TASK_ID, "Milk", false, "2026-10-02T10:00:00.000Z") })
        .resolves({ Item: task(TASK_ID, "Milk", true, "2026-10-02T10:00:00.000Z") });
      ddb.on(TransactWriteCommand).rejects(cancelled("ConditionalCheckFailed", "None"));

      const result = await handler(event("PATCH /lists/{id}/tasks/{taskId}", { body: { done: true } }));

      // The second read already shows done = true, so there is nothing left to write
      expect(result.statusCode).toBe(200);
      expect(body(result).done).toBe(true);
      expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(1);
    });

    it("returns 404 when the task does not exist", async () => {
      withAccess();
      ddb.on(GetCommand, { Key: TASK_KEY }).resolves({});

      const result = await handler(event("PATCH /lists/{id}/tasks/{taskId}", { body: { done: true } }));

      expect(result.statusCode).toBe(404);
      expect(body(result).message).toBe("Task not found.");
    });

    it("returns 404 when META is gone", async () => {
      withAccess();
      withTask(false);
      ddb.on(TransactWriteCommand).rejects(cancelled("None", "ConditionalCheckFailed"));

      const result = await handler(event("PATCH /lists/{id}/tasks/{taskId}", { body: { done: true } }));

      expect(result.statusCode).toBe(404);
      expect(body(result).message).toBe("List not found.");
    });

    it.each([
      [undefined, "Send a new title, a done value, or both."],
      [{}, "Send a new title, a done value, or both."],
      [{ done: "yes" }, "Done must be true or false."],
      [{ title: "" }, "Enter a task title."],
      [{ title: "x".repeat(212) }, "Keep the title to 200 characters or fewer. This one has 212."],
    ])("rejects %j with 400 without calling DynamoDB", async (input, message) => {
      const result = await handler(event("PATCH /lists/{id}/tasks/{taskId}", { body: input }));

      expect(result.statusCode).toBe(400);
      expect(body(result).message).toBe(message);
      expect(ddb.calls()).toHaveLength(0);
    });
  });

  describe("DELETE /lists/{id}/tasks/{taskId}", () => {
    it.each([
      [true, -1],
      [false, 0],
    ])("deletes a task with done %s and adjusts doneCount by %i", async (done, doneDelta) => {
      withAccess();
      withTask(done);
      ddb.on(TransactWriteCommand).resolves({});

      const result = await handler(event("DELETE /lists/{id}/tasks/{taskId}"));

      expect(result.statusCode).toBe(204);
      const items = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
      expect(items[0].Delete).toMatchObject({
        Key: TASK_KEY,
        ExpressionAttributeValues: { ":current": done },
      });
      expect(items[1].Update?.ExpressionAttributeValues).toEqual({ ":tasks": -1, ":done": doneDelta });
    });

    it("returns 404 when the task does not exist", async () => {
      withAccess();
      ddb.on(GetCommand, { Key: TASK_KEY }).resolves({});

      const result = await handler(event("DELETE /lists/{id}/tasks/{taskId}"));

      expect(result.statusCode).toBe(404);
      expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
    });

    it("returns 404 when META is gone", async () => {
      withAccess();
      withTask(false);
      ddb.on(TransactWriteCommand).rejects(cancelled("None", "ConditionalCheckFailed"));

      const result = await handler(event("DELETE /lists/{id}/tasks/{taskId}"));

      expect(result.statusCode).toBe(404);
    });

    it("rereads with the new done value when the task was toggled meanwhile", async () => {
      withAccess();
      ddb
        .on(GetCommand, { Key: TASK_KEY })
        .resolvesOnce({ Item: task(TASK_ID, "Milk", false, "2026-10-02T10:00:00.000Z") })
        .resolves({ Item: task(TASK_ID, "Milk", true, "2026-10-02T10:00:00.000Z") });
      ddb
        .on(TransactWriteCommand)
        .rejectsOnce(cancelled("ConditionalCheckFailed", "None"))
        .resolves({});

      const result = await handler(event("DELETE /lists/{id}/tasks/{taskId}"));

      expect(result.statusCode).toBe(204);
      const retry = ddb.commandCalls(TransactWriteCommand)[1].args[0].input.TransactItems ?? [];
      expect(retry[1].Update?.ExpressionAttributeValues).toEqual({ ":tasks": -1, ":done": -1 });
    });
  });

  describe("errors", () => {
    it("returns 404 for an unknown route", async () => {
      const result = await handler(event("GET /unknown"));

      expect(result.statusCode).toBe(404);
    });

    it("maps a transaction cancelled by throttling to 503", async () => {
      withAccess();
      ddb.on(TransactWriteCommand).rejects(cancelled("None", "ThrottlingError"));

      const result = await handler(event("POST /lists/{id}/tasks", { body: { title: "Milk" } }));

      expect(result.statusCode).toBe(503);
      expect(result.headers?.["Retry-After"]).toBe("1");
    });

    it("returns 500 when the task keeps changing on every attempt", async () => {
      withAccess();
      withTask(false);
      ddb.on(TransactWriteCommand).rejects(cancelled("ConditionalCheckFailed", "None"));

      const result = await handler(event("DELETE /lists/{id}/tasks/{taskId}"));

      expect(result.statusCode).toBe(500);
      expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(3);
    });
  });
});
