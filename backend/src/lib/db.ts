import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Created once per execution environment so warm invocations reuse connections
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Returns the table name from the function's environment.
 *
 * @returns Value of `TABLE_NAME`
 */
export function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) {
    throw new Error("TABLE_NAME is not set");
  }
  return name;
}

export const META_SK = "META";

/**
 * @param userId - Cognito `sub`
 * @returns Partition key of the user's access items
 */
export function userPk(userId: string): string {
  return `USER#${userId}`;
}

/**
 * @param listId - List UUID
 * @returns Partition key of the list's items, also the access item sort key
 */
export function listKey(listId: string): string {
  return `LIST#${listId}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks the shape of an ID before any DynamoDB call, so malformed IDs cost no capacity.
 *
 * @param value - Path parameter to check
 * @returns True when the value is a UUID
 */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

/** Raised when a batch still has unprocessed items after every retry */
export class UnprocessedItemsError extends Error {
  constructor(operation: string) {
    super(`${operation} left unprocessed items after retries`);
    this.name = "UnprocessedItemsError";
  }
}

const THROTTLING_ERRORS = new Set([
  "ProvisionedThroughputExceededException",
  "ThrottlingException",
  "RequestLimitExceeded",
  "UnprocessedItemsError",
]);

const THROTTLING_CANCELLATION_CODES = new Set(["ThrottlingError", "ProvisionedThroughputExceeded"]);

/**
 * Tells whether an error comes from DynamoDB throttling, including throttled transactions.
 *
 * @param err - Error thrown by the SDK or by the batch helpers
 * @returns True when the client should retry later
 */
export function isThrottlingError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  if (THROTTLING_ERRORS.has(err.name)) {
    return true;
  }
  if (err.name === "TransactionCanceledException") {
    const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
    return reasons.some((reason) => THROTTLING_CANCELLATION_CODES.has(reason.Code ?? ""));
  }
  return false;
}

const BATCH_MAX_ATTEMPTS = 5;
const BATCH_BASE_DELAY_MS = 50;

/**
 * Runs a batch operation until nothing is left unprocessed, with exponential backoff.
 *
 * @param operation - Name used in the error message
 * @param initial - First request payload
 * @param send - Sends one request and returns what is still unprocessed, if anything
 * @returns Resolves once every item was processed
 */
export async function withBatchRetries<T>(
  operation: string,
  initial: T,
  send: (request: T) => Promise<T | undefined>
): Promise<void> {
  let pending: T | undefined = initial;
  for (let attempt = 0; attempt < BATCH_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_BASE_DELAY_MS * 2 ** attempt));
    }
    pending = await send(pending);
    if (pending === undefined) {
      return;
    }
  }
  throw new UnprocessedItemsError(operation);
}
