import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { handler } from "./lists.js";

const ddb = mockClient(DynamoDBDocumentClient);

const USER = "user-1";
const LIST_ID = "0b7f1a52-3c1e-4d8e-9a4f-2f6d1c9e8b10";
const OTHER_LIST_ID = "6a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function event(
  routeKey: string,
  options: { id?: string; body?: unknown; rawBody?: string; sub?: string | null } = {}
) {
  const sub = options.sub === undefined ? USER : options.sub;
  return {
    routeKey,
    pathParameters: options.id ? { id: options.id } : undefined,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    isBase64Encoded: false,
    requestContext: {
      authorizer: sub ? { jwt: { claims: { sub }, scopes: null } } : undefined,
    },
  } as unknown as Parameters<typeof handler>[0];
}

function meta(id: string, name: string, createdAt: string) {
  return {
    PK: `LIST#${id}`,
    SK: "META",
    name,
    ownerId: USER,
    taskCount: 2,
    doneCount: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

function body(result: Awaited<ReturnType<typeof handler>>) {
  return JSON.parse(result.body as string);
}

function throttled(name = "ProvisionedThroughputExceededException") {
  return Object.assign(new Error("Rate exceeded"), { name });
}

beforeEach(() => {
  ddb.reset();
  process.env.TABLE_NAME = "todolist";
});

describe("lists handler", () => {
  it("returns 401 without JWT claims", async () => {
    const result = await handler(event("GET /lists", { sub: null }));
    expect(result.statusCode).toBe(401);
  });

  describe("GET /lists", () => {
    it("returns the caller's lists newest first, read from META", async () => {
      ddb.on(QueryCommand).resolves({
        Items: [
          { PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` },
          { PK: `USER#${USER}`, SK: `LIST#${OTHER_LIST_ID}` },
        ],
      });
      ddb.on(BatchGetCommand).resolves({
        Responses: {
          todolist: [
            meta(LIST_ID, "Older", "2026-10-01T10:00:00.000Z"),
            meta(OTHER_LIST_ID, "Newer", "2026-10-02T10:00:00.000Z"),
          ],
        },
      });

      const result = await handler(event("GET /lists"));

      expect(result.statusCode).toBe(200);
      expect(body(result).lists.map((list: { name: string }) => list.name)).toEqual(["Newer", "Older"]);
      expect(body(result).lists[0]).toEqual({
        id: OTHER_LIST_ID,
        name: "Newer",
        taskCount: 2,
        doneCount: 1,
        createdAt: "2026-10-02T10:00:00.000Z",
        updatedAt: "2026-10-02T10:00:00.000Z",
      });
      const query = ddb.commandCalls(QueryCommand)[0].args[0].input;
      expect(query.ExpressionAttributeValues).toEqual({ ":pk": `USER#${USER}`, ":sk": "LIST#" });
    });

    it("returns an empty array without calling BatchGetItem when the user has no lists", async () => {
      ddb.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event("GET /lists"));

      expect(body(result)).toEqual({ lists: [] });
      expect(ddb.commandCalls(BatchGetCommand)).toHaveLength(0);
    });

    it("skips access items whose META is gone (list mid-delete)", async () => {
      ddb.on(QueryCommand).resolves({
        Items: [
          { PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` },
          { PK: `USER#${USER}`, SK: `LIST#${OTHER_LIST_ID}` },
        ],
      });
      ddb.on(BatchGetCommand).resolves({
        Responses: { todolist: [meta(LIST_ID, "Groceries", "2026-10-01T10:00:00.000Z")] },
      });

      const result = await handler(event("GET /lists"));

      expect(result.statusCode).toBe(200);
      expect(body(result).lists.map((list: { id: string }) => list.id)).toEqual([LIST_ID]);
    });

    it("returns an empty array when every META is gone", async () => {
      ddb.on(QueryCommand).resolves({ Items: [{ PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` }] });
      ddb.on(BatchGetCommand).resolves({ Responses: {} });

      const result = await handler(event("GET /lists"));

      expect(result.statusCode).toBe(200);
      expect(body(result)).toEqual({ lists: [] });
    });

    it("retries unprocessed keys from BatchGetItem", async () => {
      ddb.on(QueryCommand).resolves({ Items: [{ PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` }] });
      const keys = { todolist: { Keys: [{ PK: `LIST#${LIST_ID}`, SK: "META" }] } };
      ddb
        .on(BatchGetCommand)
        .resolvesOnce({ Responses: { todolist: [] }, UnprocessedKeys: keys })
        .resolvesOnce({ Responses: { todolist: [meta(LIST_ID, "Groceries", "2026-10-01T10:00:00.000Z")] } });

      const result = await handler(event("GET /lists"));

      expect(body(result).lists).toHaveLength(1);
      expect(ddb.commandCalls(BatchGetCommand)).toHaveLength(2);
    });

    it("follows Query pagination", async () => {
      ddb
        .on(QueryCommand)
        .resolvesOnce({
          Items: [{ PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` }],
          LastEvaluatedKey: { PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` },
        })
        .resolvesOnce({ Items: [{ PK: `USER#${USER}`, SK: `LIST#${OTHER_LIST_ID}` }] });
      ddb.on(BatchGetCommand).resolves({ Responses: { todolist: [] } });

      await handler(event("GET /lists"));

      const keys = ddb.commandCalls(BatchGetCommand)[0].args[0].input.RequestItems?.todolist.Keys;
      expect(keys).toHaveLength(2);
    });
  });

  describe("POST /lists", () => {
    it("creates META and the owner access item in one transaction", async () => {
      ddb.on(TransactWriteCommand).resolves({});

      const result = await handler(event("POST /lists", { body: { name: "  Groceries  " } }));

      expect(result.statusCode).toBe(201);
      const created = body(result);
      expect(created).toMatchObject({ name: "Groceries", taskCount: 0, doneCount: 0 });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

      const items = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
      expect(items).toHaveLength(2);
      expect(items[0].Put?.Item).toMatchObject({
        PK: `LIST#${created.id}`,
        SK: "META",
        name: "Groceries",
        ownerId: USER,
      });
      expect(items[1].Put?.Item).toMatchObject({
        PK: `USER#${USER}`,
        SK: `LIST#${created.id}`,
        role: "owner",
      });
    });

    it.each([
      [{}, "Enter a name for the list."],
      [{ name: "   " }, "Enter a name for the list."],
      [{ name: 42 }, "The list name must be text."],
      [{ name: "x".repeat(61) }, "Keep the name to 60 characters or fewer. This one has 61."],
    ])("rejects %j with 400", async (input, message) => {
      const result = await handler(event("POST /lists", { body: input }));

      expect(result.statusCode).toBe(400);
      expect(body(result).message).toBe(message);
      expect(ddb.calls()).toHaveLength(0);
    });

    it("accepts a name of exactly 60 characters after trimming", async () => {
      ddb.on(TransactWriteCommand).resolves({});

      const result = await handler(event("POST /lists", { body: { name: ` ${"x".repeat(60)} ` } }));

      expect(result.statusCode).toBe(201);
    });

    it("rejects a body that is not JSON with 400", async () => {
      const result = await handler(event("POST /lists", { rawBody: "{name:" }));

      expect(result.statusCode).toBe(400);
    });
  });

  describe("PATCH /lists/{id}", () => {
    it("renames META with a single update", async () => {
      ddb.on(GetCommand).resolves({ Item: { PK: `USER#${USER}` } });
      ddb.on(UpdateCommand).resolves({ Attributes: meta(LIST_ID, "Weekly groceries", "2026-10-01T10:00:00.000Z") });

      const result = await handler(event("PATCH /lists/{id}", { id: LIST_ID, body: { name: "Weekly groceries" } }));

      expect(result.statusCode).toBe(200);
      expect(body(result).name).toBe("Weekly groceries");
      const update = ddb.commandCalls(UpdateCommand)[0].args[0].input;
      expect(update.Key).toEqual({ PK: `LIST#${LIST_ID}`, SK: "META" });
      expect(update.ExpressionAttributeValues?.[":name"]).toBe("Weekly groceries");
    });

    it("returns 404 for another user's list without updating it", async () => {
      ddb.on(GetCommand).resolves({});

      const result = await handler(event("PATCH /lists/{id}", { id: LIST_ID, body: { name: "Mine now" } }));

      expect(result.statusCode).toBe(404);
      expect(ddb.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({
        PK: `USER#${USER}`,
        SK: `LIST#${LIST_ID}`,
      });
      expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
    });

    it("returns 404 when META is already gone", async () => {
      ddb.on(GetCommand).resolves({ Item: { PK: `USER#${USER}` } });
      ddb.on(UpdateCommand).rejects(Object.assign(new Error("failed"), { name: "ConditionalCheckFailedException" }));

      const result = await handler(event("PATCH /lists/{id}", { id: LIST_ID, body: { name: "Groceries" } }));

      expect(result.statusCode).toBe(404);
    });

    it("validates the name with 400", async () => {
      const result = await handler(event("PATCH /lists/{id}", { id: LIST_ID, body: { name: "" } }));

      expect(result.statusCode).toBe(400);
    });
  });

  describe("DELETE /lists/{id}", () => {
    it("deletes META, then every item in the list, then the access item", async () => {
      ddb.on(GetCommand).resolves({ Item: { PK: `USER#${USER}` } });
      ddb.on(DeleteCommand).resolves({});
      const tasks = Array.from({ length: 30 }, (_, i) => ({ PK: `LIST#${LIST_ID}`, SK: `TASK#${i}` }));
      ddb.on(QueryCommand).resolves({ Items: tasks });
      ddb.on(BatchWriteCommand).resolves({});

      const result = await handler(event("DELETE /lists/{id}", { id: LIST_ID }));

      expect(result.statusCode).toBe(204);
      const deletes = ddb.commandCalls(DeleteCommand).map((call) => call.args[0].input.Key);
      expect(deletes).toEqual([
        { PK: `LIST#${LIST_ID}`, SK: "META" },
        { PK: `USER#${USER}`, SK: `LIST#${LIST_ID}` },
      ]);
      const batches = ddb.commandCalls(BatchWriteCommand).map((call) => call.args[0].input.RequestItems?.todolist.length);
      expect(batches).toEqual([25, 5]);
      const order = ddb.calls().map((call) => call.args[0].constructor.name);
      expect(order).toEqual([
        "GetCommand",
        "DeleteCommand",
        "QueryCommand",
        "BatchWriteCommand",
        "BatchWriteCommand",
        "DeleteCommand",
      ]);
    });

    it("returns 404 for another user's list without deleting anything", async () => {
      ddb.on(GetCommand).resolves({});

      const result = await handler(event("DELETE /lists/{id}", { id: LIST_ID }));

      expect(result.statusCode).toBe(404);
      expect(ddb.commandCalls(DeleteCommand)).toHaveLength(0);
    });

    it("keeps the access item when deleting tasks fails, so the delete can be retried", async () => {
      ddb.on(GetCommand).resolves({ Item: { PK: `USER#${USER}` } });
      ddb.on(DeleteCommand).resolves({});
      ddb.on(QueryCommand).resolves({ Items: [{ PK: `LIST#${LIST_ID}`, SK: "TASK#1" }] });
      ddb.on(BatchWriteCommand).rejects(throttled());

      const result = await handler(event("DELETE /lists/{id}", { id: LIST_ID }));

      expect(result.statusCode).toBe(503);
      const deletes = ddb.commandCalls(DeleteCommand).map((call) => call.args[0].input.Key);
      expect(deletes).toEqual([{ PK: `LIST#${LIST_ID}`, SK: "META" }]);
    });
  });

  describe("path validation", () => {
    it.each(["PATCH /lists/{id}", "DELETE /lists/{id}"])(
      "%s returns 404 for a non-UUID id without calling DynamoDB",
      async (routeKey) => {
        const result = await handler(event(routeKey, { id: "not-a-uuid", body: { name: "Groceries" } }));

        expect(result.statusCode).toBe(404);
        expect(ddb.calls()).toHaveLength(0);
      }
    );

    it("returns 404 for an unknown route", async () => {
      const result = await handler(event("GET /unknown"));

      expect(result.statusCode).toBe(404);
    });
  });

  describe("errors", () => {
    it.each(["ProvisionedThroughputExceededException", "ThrottlingException"])(
      "maps %s to a retryable 503",
      async (name) => {
        ddb.on(QueryCommand).rejects(throttled(name));

        const result = await handler(event("GET /lists"));

        expect(result.statusCode).toBe(503);
        expect(result.headers?.["Retry-After"]).toBe("1");
      }
    );

    it("maps a transaction cancelled by throttling to 503", async () => {
      ddb.on(TransactWriteCommand).rejects(
        Object.assign(new Error("cancelled"), {
          name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "None" }, { Code: "ThrottlingError" }],
        })
      );

      const result = await handler(event("POST /lists", { body: { name: "Groceries" } }));

      expect(result.statusCode).toBe(503);
    });

    it("returns 503 when BatchWriteItem keeps leaving items unprocessed", async () => {
      ddb.on(GetCommand).resolves({ Item: { PK: `USER#${USER}` } });
      ddb.on(DeleteCommand).resolves({});
      const key = { PK: `LIST#${LIST_ID}`, SK: "TASK#1" };
      ddb.on(QueryCommand).resolves({ Items: [key] });
      ddb.on(BatchWriteCommand).resolves({ UnprocessedItems: { todolist: [{ DeleteRequest: { Key: key } }] } });

      const result = await handler(event("DELETE /lists/{id}", { id: LIST_ID }));

      expect(result.statusCode).toBe(503);
      expect(ddb.commandCalls(BatchWriteCommand)).toHaveLength(5);
    });

    it("returns 500 for unexpected errors", async () => {
      ddb.on(QueryCommand).rejects(new Error("boom"));

      const result = await handler(event("GET /lists"));

      expect(result.statusCode).toBe(500);
      expect(body(result).message).toBe("Something went wrong.");
    });
  });
});
