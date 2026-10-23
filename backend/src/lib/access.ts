import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { db, listKey, tableName, userPk } from "./db.js";

/**
 * Checks that the user has an access item for the list.
 *
 * Callers answer 404 when this returns false, so the API never reveals
 * whether another user's list exists.
 *
 * @param userId - Cognito `sub` of the caller
 * @param listId - List UUID
 * @returns True when the access item exists
 */
export async function hasAccess(userId: string, listId: string): Promise<boolean> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: userPk(userId), SK: listKey(listId) },
      ProjectionExpression: "PK",
    })
  );
  return result.Item !== undefined;
}
