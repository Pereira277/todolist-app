import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { handler } from "./me.js";

function eventWithClaims(claims?: Record<string, string>): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    requestContext: {
      authorizer: claims ? { jwt: { claims, scopes: null } } : undefined,
    },
  } as APIGatewayProxyEventV2WithJWTAuthorizer;
}

describe("GET /me handler", () => {
  it("returns the user's id, email and name from the JWT claims", async () => {
    const event = eventWithClaims({
      sub: "abc-123",
      email: "lucas@example.com",
      name: "Lucas Pereira",
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual({
      userId: "abc-123",
      email: "lucas@example.com",
      name: "Lucas Pereira",
    });
  });

  it("returns 401 when the request has no JWT claims", async () => {
    const event = eventWithClaims(undefined);

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });
});
