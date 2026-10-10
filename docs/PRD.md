# PRD — Shareable TodoList

**Status:** Active · **Owner:** Lucas Pereira · **Last reviewed:** 2026-10-10

## 1. Problem
People who split chores (couples, roommates, family) need a simple list that everyone involved can see and edit, without the complexity of project management tools.

## 2. Goals
- **Product:** minimal todo list with list sharing between users.
- **Learning:** practice AWS serverless architecture (SAA-C03 domains).
- **Portfolio:** demonstrate SRE practices (SLOs, observability, DR, postmortems).

## 3. Users and scenarios
- **Owner:** creates lists and tasks and invites another user by email.
- **Guest:** sees lists shared with them and checks/edits tasks according to their permission.

## 4. MVP scope (v0.3)
| # | Requirement | Version |
|---|-------------|---------|
| R1 | Sign-up and sign-in with email/password (Cognito) | v0.1 |
| R2 | Authenticated page showing the user's name | v0.1 |
| R3 | Create, rename and delete lists | v0.2 |
| R4 | Create, edit, complete and delete tasks within a list | v0.2 |
| R5 | Share a list by email with an already registered user | v0.3 |
| R6 | Per-share permission: `viewer` (read-only) or `editor` | v0.3 |
| R7 | "My lists" and "Shared with me" views | v0.3 |
| R8 | Owner can revoke a share | v0.3 |

## 5. Out of scope (do NOT build in the MVP)
- Inviting people without an account (invitation emails)
- Real-time sync (WebSocket). A page refresh is enough.
- Due dates, reminders, notifications, priorities, tags, attachments
- Subtasks, drag-and-drop ordering
- Social login (Google etc.)
- Native mobile app, offline mode
- Internationalization

> Any item above only enters through a new ROADMAP version and an update to this PRD.

## 6. Non-functional requirements
- **Cost:** up to USD 1/month at portfolio usage (free tier)
- **Availability (initial SLO from v0.4):** 99.5% successful API requests over 30 days
- **Latency:** API p95 below 300 ms
- **Security:** every API route authenticated (Cognito JWT); users can only access their own lists or lists shared with them

## 7. MVP success criteria
- Two real users can share a list and edit the same task
- Fully automated deploy via GitHub Actions from `main`
- Documentation lets the project be resumed after a 30-day break in under 10 minutes
