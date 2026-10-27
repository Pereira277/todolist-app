import { fetchAuthSession } from "aws-amplify/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL. Copy frontend/.env.example to frontend/.env.local and fill in the HTTP API URL."
  );
}

/** List as returned by the API */
export type List = {
  id: string;
  name: string;
  taskCount: number;
  doneCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Non-2xx answer from the API, carrying the message from its JSON body when there is one */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const session = await fetchAuthSession();
  // The ID token is sent instead of the access token because only it carries
  // the "email" and "name" claims the API reads
  const idToken = session.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("No ID token in the current session");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      typeof payload?.message === "string" ? payload.message : `${method} ${path} failed with status ${response.status}`;
    // Only readable when the API exposes the header through CORS
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(response.status, message, retryAfter > 0 ? retryAfter : undefined);
  }

  return response;
}

/**
 * Fetches the signed-in user's lists from GET /lists.
 *
 * @returns The lists, newest first.
 * @throws If there is no session, the network fails or the API answers with a non-2xx status.
 */
export async function fetchLists(): Promise<List[]> {
  const response = await request("GET", "/lists");
  const { lists } = (await response.json()) as { lists: List[] };
  return lists;
}

/**
 * Creates a list with POST /lists.
 *
 * @param name - List name, already validated
 * @returns The created list.
 * @throws ApiError with the API message on 400, or any other failure.
 */
export async function createList(name: string): Promise<List> {
  const response = await request("POST", "/lists", { name });
  return response.json();
}

/**
 * Renames a list with PATCH /lists/{id}.
 *
 * @param id - List id
 * @param name - New name, already validated
 * @returns The updated list.
 * @throws ApiError with the API message on 400, 404 when the list is gone, or any other failure.
 */
export async function renameList(id: string, name: string): Promise<List> {
  const response = await request("PATCH", `/lists/${encodeURIComponent(id)}`, { name });
  return response.json();
}

const DELETE_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deletes a list with DELETE /lists/{id}, retrying on 500 and 503.
 *
 * A list delete is not atomic on the server (ADR-0002), so repeating a failed
 * call finishes the job. A 404 on a retry means an earlier attempt already
 * removed the list.
 *
 * @param id - List id
 * @returns Resolves once the list is gone.
 * @throws The last error when every attempt fails, or the first non-retryable one.
 */
export async function deleteList(id: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await request("DELETE", `/lists/${encodeURIComponent(id)}`);
      return;
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.status === 404 && attempt > 0) return;
      if ((err.status !== 500 && err.status !== 503) || attempt === DELETE_RETRIES) throw err;
      const delayMs =
        err.status === 503 && err.retryAfterSeconds !== undefined
          ? err.retryAfterSeconds * 1000
          : DEFAULT_RETRY_DELAY_MS * (attempt + 1);
      await wait(delayMs);
    }
  }
}
