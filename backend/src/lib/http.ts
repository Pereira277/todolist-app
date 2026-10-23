import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type ApiResult = APIGatewayProxyStructuredResultV2;

/**
 * Builds a JSON response.
 *
 * @param statusCode - HTTP status code
 * @param body - Value serialized as the response body
 * @param headers - Extra headers merged over the JSON content type
 * @returns API Gateway proxy result
 */
export function jsonResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): ApiResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

/**
 * Builds an empty response, used for successful deletes.
 *
 * @param statusCode - HTTP status code
 * @returns API Gateway proxy result without a body
 */
export function emptyResponse(statusCode: number): ApiResult {
  return { statusCode };
}

/**
 * Returns the caller's Cognito user ID from the validated JWT.
 *
 * @param event - HTTP API event with JWT authorizer context
 * @returns The `sub` claim, or undefined when the request carries no claims
 */
export function getUserId(event: ApiEvent): string | undefined {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : undefined;
}

export type ParsedBody = { ok: true; value: unknown } | { ok: false };

/**
 * Parses the request body as JSON.
 *
 * @param event - HTTP API event
 * @returns The parsed value, or `ok: false` when the body is not valid JSON
 */
export function parseJsonBody(event: ApiEvent): ParsedBody {
  if (!event.body) {
    return { ok: true, value: undefined };
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
