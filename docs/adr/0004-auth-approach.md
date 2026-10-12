# ADR-0004: Authentication approach for the frontend

- **Status:** Accepted
- **Date:** 2026-10-12

## Context
PRD R1/R2 require email/password sign-up, confirmation, sign-in and sign-out against a
Cognito User Pool, plus a protected page showing the signed-in user's name. The v0.1 UI
mockups (kept outside the repository) define custom screens for sign-up, email
confirmation and sign-in, including loading and error states (invalid email, wrong
password, network error, expired/invalid code). The frontend is a static export with no
server, so every auth call runs client-side with public, secret-less SPA credentials.

## Options considered
1. **Cognito Managed Login (Hosted UI):** Cognito-hosted pages handle sign-up, sign-in and
   confirmation via redirect and the OAuth2/OIDC code flow. Pros: no auth UI to build or
   maintain; Cognito handles SRP and token exchange. Cons: visual control is limited to a
   theme, not full custom screens; does not match the mockups' per-state designs (loading,
   invalid email, wrong password, etc.); the redirect flow adds complexity compared to a
   direct API client for a static export.
2. **Custom UI forms with Amplify Auth v6 (SRP):** our own sign-up, confirm-email and
   sign-in pages, matching the mockups exactly, calling Cognito through the Amplify Auth v6
   client, which implements the SRP protocol and session/token handling. Pros: full fidelity
   to the mockups and their states; Amplify Auth handles token storage and refresh instead of
   hand-rolled SRP math; well documented for SPA use. Cons: adds the `aws-amplify`
   dependency; one more library's conventions to learn on top of Cognito itself.

## Decision
We chose **custom UI forms with Amplify Auth v6**. The sign-up, confirm-email and sign-in
screens are built to match the mockups, calling Cognito through `aws-amplify/auth`
(`signUp`, `confirmSignUp`, `signIn`, `signOut`, `getCurrentUser`/`fetchAuthSession`).
Amplify is configured client-side from `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and
`NEXT_PUBLIC_COGNITO_CLIENT_ID`.

## Consequences
- Positive: pixel-and-state fidelity to the design; no SRP or token-refresh code to maintain
  ourselves; Amplify's session handling works cleanly with client components in a
  statically exported app.
- Negative / trade-offs: adds `aws-amplify` to the bundle; the project now depends on
  Amplify Auth's configuration shape and version upgrades.
- What needs revisiting, and when: if MFA or social login is added later (both out of scope
  for v0.1), re-check whether Amplify Auth still covers the flow cleanly or whether Managed
  Login becomes preferable.

## SAA-C03 relevance
Cognito User Pools vs Identity Pools, the SRP auth flow, JWT (ID/access/refresh tokens),
and app client types (public vs confidential).
