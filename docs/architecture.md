# Architecture

## Overview (MVP target, v0.3)

```mermaid
flowchart LR
  U[User / Browser] --> CF[CloudFront]
  CF --> S3[(S3 - static Next.js)]
  U -->|sign-in| COG[Cognito User Pool]
  U -->|JWT| APIGW[API Gateway HTTP API]
  APIGW -->|JWT authorizer| COG
  APIGW --> L[Lambda handlers]
  L --> DDB[(DynamoDB - single table)]
  L --> CW[CloudWatch Logs/Metrics]
```

## Components
| Component | Service | Why |
|-----------|---------|-----|
| Hosting | S3 + CloudFront (OAC) | Static, cheap, HTTPS, caching |
| Auth | Cognito User Pool | Managed, free tier, issues JWTs |
| API | API Gateway HTTP API | Cheaper than REST API, native JWT authorizer |
| Logic | Lambda (Node 24/TS) | Pay-per-use, no servers |
| Data | DynamoDB on-demand | Serverless, free tier, see ADR-0002 |

### Hosting (live, v0.1)
- Private S3 bucket (`todolist-frontend-lp2779`, us-east-1) holds the static export; Block
  Public Access is on and it is never reachable directly, only through CloudFront.
- CloudFront distribution (`d1sa68e9am4aht.cloudfront.net`) reads the bucket through an
  Origin Access Control; the bucket policy grants `s3:GetObject` only to the CloudFront
  service principal, scoped to this distribution's ARN.
- A CloudFront Function (`todolist-index-rewrite`, `infra/cloudfront/index-rewrite.js`) runs
  on viewer-request to append `index.html` to directory-style URIs, since CloudFront's
  default root object only applies to `/`.
- Custom error responses map 403 and 404 to `/404.html` with a 404 status — the Next.js
  static export emits one HTML file per route (not a single SPA `index.html`), so unknown
  paths are served the generated not-found page instead.

### Auth (live, v0.1)
- Cognito User Pool `us-east-1_P1IpEKgOO` (Essentials plan): sign-in by email, required
  `name` attribute, no MFA. App client `todolist-web` is a public SPA client (no secret)
  with `ALLOW_USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`, token revocation and "prevent
  user existence errors" on (see ADR-0004).
- The frontend is a static export with no server, so `/sign-up`, `/confirm`, `/sign-in` and
  the protected `/app` route run entirely client-side, calling Cognito through Amplify
  Auth v6 (SRP). The User Pool ID and App Client ID come from
  `NEXT_PUBLIC_COGNITO_USER_POOL_ID` / `NEXT_PUBLIC_COGNITO_CLIENT_ID` (`frontend/.env.local`,
  not committed; see `frontend/.env.example`).
- `/app` reads the signed-in user's attributes client-side on mount; if that call fails
  (no valid session) it redirects to `/sign-in`. There is no server-side session check —
  the "protection" is a client-side redirect, consistent with a fully static site.
- Because "prevent user existence errors" is on, Cognito returns the same
  `NotAuthorizedException` for both an unknown email and a wrong password; the sign-in page
  shows one generic "incorrect email or password" message rather than revealing which case
  occurred.

### API (live, v0.1)
```mermaid
sequenceDiagram
  participant B as Browser (static app)
  participant C as Cognito User Pool
  participant G as API Gateway HTTP API
  participant L as Lambda todolist-me
  B->>C: Sign in (SRP)
  C-->>B: ID, access and refresh tokens
  B->>G: GET /me (Authorization: Bearer ID token)
  G->>C: Fetch signing keys (JWKS, cached)
  alt Missing, expired or invalid token
    G-->>B: 401 Unauthorized
  else Valid token
    G->>L: Invoke with the token claims (payload 2.0)
    L-->>G: 200 { userId, email, name }
    G-->>B: 200 { userId, email, name }
  end
```
- HTTP API `todolist-api` (`https://1vdohdj087.execute-api.us-east-1.amazonaws.com`), single
  `$default` stage with auto-deploy. An HTTP API was chosen over a REST API because it is
  cheaper and has a native JWT authorizer; nothing here needs REST-only features (usage
  plans, request validation, WAF).
- The `cognito-jwt` authorizer validates the token's signature, expiry, issuer (the User
  Pool) and audience (the `todolist-web` App Client) before the Lambda is invoked. A request
  without a valid token gets a 401 from API Gateway and never reaches the function, so it
  costs no Lambda invocation.
- The frontend sends the Cognito **ID token**, not the access token: only the ID token
  carries the `email` and `name` claims, and its `aud` claim matches the authorizer's
  audience. `/app` renders the name and email returned by `GET /me`.
- The Lambda (`todolist-me`, Node.js 24, arm64) only maps the already validated claims to
  the response body, so it calls no AWS API. Its execution role is least privilege: write
  access to its own CloudWatch log group and nothing else.
- CORS is handled by API Gateway, not by the handler: only the CloudFront origin and
  `http://localhost:3000` (local development) are allowed, with the `authorization` and
  `content-type` headers and the GET method. API Gateway answers the preflight `OPTIONS`
  request itself, without the authorizer.
- Default route throttling (rate 10 requests/s, burst 20) caps the blast radius of a
  runaway client or abuse while the API is public.
- The API URL comes from `NEXT_PUBLIC_API_URL` (`frontend/.env.local`, not committed; see
  `frontend/.env.example`).

## Data model (draft, see ADR-0002)
| Entity | PK | SK | Attributes |
|--------|----|----|------------|
| List | `LIST#<listId>` | `META` | name, ownerId, createdAt |
| Task | `LIST#<listId>` | `TASK#<taskId>` | title, done, updatedAt |
| Access | `USER#<userId>` | `LIST#<listId>` | role (owner/editor/viewer), listName |

- "My lists and shared with me" = `Query PK = USER#<userId>`
- Open a list = `Query PK = LIST#<listId>`
- Authorization: before any list operation, check for the `USER#<userId> / LIST#<listId>` item.

## Endpoints
| Method | Route | Version |
|--------|-------|---------|
| GET | /me | v0.1 (live) |
| GET/POST | /lists | v0.2 |
| PATCH/DELETE | /lists/{id} | v0.2 |
| GET/POST | /lists/{id}/tasks | v0.2 |
| PATCH/DELETE | /lists/{id}/tasks/{taskId} | v0.2 |
| POST/DELETE | /lists/{id}/shares | v0.3 |
