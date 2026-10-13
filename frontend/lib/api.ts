import { fetchAuthSession } from "aws-amplify/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL. Copy frontend/.env.example to frontend/.env.local and fill in the HTTP API URL."
  );
}

export type Me = { userId: string; email: string; name: string };

/**
 * Fetches the signed-in user's profile from GET /me.
 *
 * @returns The user id, email and name read by the API from the token claims.
 * @throws If there is no session, the network fails or the API answers with a non-2xx status.
 */
export async function fetchMe(): Promise<Me> {
  const session = await fetchAuthSession();
  // The ID token is sent instead of the access token because only it carries
  // the "email" and "name" claims the API returns
  const idToken = session.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("No ID token in the current session");
  }

  const response = await fetch(`${apiUrl}/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error(`GET /me failed with status ${response.status}`);
  }

  return response.json();
}
