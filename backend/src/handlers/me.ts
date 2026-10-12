import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * GET /me — returns the signed-in user's id, email and name.
 *
 * The frontend must send the Cognito ID token as the Authorization bearer
 * token, not the access token: only the ID token carries the "email" and
 * "name" claims, since those come from the user's profile, not from the
 * access token's scopes.
 *
 * The HTTP API JWT authorizer already validated the token before invoking
 * this handler, so the claims below are trusted. The explicit 401 below is
 * a defensive fallback (e.g. direct Lambda invocation in tests) — in
 * production, API Gateway rejects unauthenticated requests before they
 * ever reach this function.
 */
export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyStructuredResultV2> {
  const claims = event.requestContext.authorizer?.jwt?.claims;

  if (!claims) {
    return jsonResponse(401, { message: "Unauthorized" });
  }

  return jsonResponse(200, {
    userId: claims.sub,
    email: claims.email,
    name: claims.name,
  });
}
