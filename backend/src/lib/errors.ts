import { isThrottlingError } from "./db.js";
import { jsonResponse, type ApiResult } from "./http.js";

/**
 * Turns an error a handler did not expect into a response, logging it as structured JSON.
 *
 * @param err - Error thrown while handling the request
 * @param routeKey - Route being served, for the log entry
 * @returns 503 with `Retry-After` when DynamoDB throttled the request, 500 otherwise
 */
export function errorResponse(err: unknown, routeKey: string): ApiResult {
  if (isThrottlingError(err)) {
    console.warn(JSON.stringify({ level: "warn", message: "DynamoDB throttled", routeKey }));
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
      routeKey,
      error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    })
  );
  return jsonResponse(500, { message: "Something went wrong." });
}
