# ADR-0002: DynamoDB single-table design

- **Status:** Accepted
- **Date:** 2026-10-10 (proposed), 2026-10-21 (revised and accepted for v0.2)

## Context
We need to store lists, tasks and who can access each list. The access patterns, as of the
v0.2 mockups, are:
1. List every list a user can see, with its name and progress ("3 of 5 done")
2. Open a list with all of its tasks
3. Check whether a user has permission on a list
4. Rename a list
5. Delete a list together with its tasks
6. Add, edit, complete and delete a task, keeping the list's progress correct

Sharing (v0.3) adds more access items per list, so the model must not require fanning out a
write to every user who can see a list. The cost target is USD 0, and the DynamoDB free tier
only covers **provisioned** capacity (25 GB, 25 RCU and 25 WCU per account and region);
on-demand requests are always billed.

## Options considered
1. **One table per entity (Lists, Tasks, Shares):** familiar, but each screen needs several
   queries and every table takes its own share of the provisioned capacity.
2. **Single table with composite PK/SK:** each access pattern is one `Query`, `GetItem` or
   `BatchGetItem`.
3. **RDS/Aurora:** relational modeling is easy, but costly outside the free tier and not
   truly serverless.

For the list name and progress shown in "My lists":

- **A. Copy `listName` into every access item** and keep it in sync on rename with
  `TransactWriteItems`: "My lists" is a single `Query`, but a rename writes one item per
  user with access (and transactions cost twice the WCU), the progress counters would need
  the same fan-out on every task change, and a transaction is capped at 100 items.
- **B. Copy `listName` into access items with separate writes:** cheaper than a transaction,
  but a partial failure leaves stale names with nothing to repair them.
- **C. Keep name and counters only on the list item** and read them with `BatchGetItem`
  after the `Query`: "My lists" costs one extra request, but rename and progress are a single
  write each, and nothing is duplicated.

## Decision
**Option 2 (single table) with approach C**, provisioned capacity and no backups.

### Table
- Name `todolist`, partition key `PK` (String), sort key `SK` (String), no secondary indexes.
- **Provisioned 5 RCU / 5 WCU, auto scaling off.** This keeps the table inside the free tier
  with room for future tables or a GSI (any index capacity counts toward the same
  25 RCU / 25 WCU). Auto scaling is off because it could raise capacity past the free tier.
- **Point-in-time recovery off** and no on-demand backups: both are billed and the data is
  not worth paying to protect at portfolio scale. Accepted trade-off: a bad deploy or a
  manual mistake can lose data with no restore path.
- Deletion protection on, encryption with the AWS owned key (free).

### Items
| Entity | PK | SK | Attributes |
|--------|----|----|------------|
| List | `LIST#<listId>` | `META` | name, ownerId, taskCount, doneCount, createdAt, updatedAt |
| Task | `LIST#<listId>` | `TASK#<taskId>` | title, done, createdAt, updatedAt |
| Access | `USER#<userId>` | `LIST#<listId>` | role (owner, later editor/viewer), createdAt |

`userId` is the Cognito `sub` claim. List and task IDs follow ADR-0006.

### Access patterns
1. **My lists:** `Query PK = USER#<userId>, begins_with(SK, "LIST#")`, then `BatchGetItem` on
   the `LIST#<listId> / META` items (up to 100 keys per call) for name and counters.
2. **Open a list:** `Query PK = LIST#<listId>` returns the `META` item and every task in one
   request. Tasks are sorted by `createdAt` in the handler, since random IDs have no order.
3. **Check access:** `GetItem USER#<userId> / LIST#<listId>` before any list operation; a
   missing item returns 404, so the API never reveals whether a list exists.
4. **Rename:** one `UpdateItem` on `META`. Nothing else holds the name.
5. **Delete a list:** delete `META` first, which hides the list from "My lists" and makes
   every task write fail its `attribute_exists` condition; then `Query` the list partition
   (keys only) and remove the tasks with `BatchWriteItem` in chunks of 25, retrying
   unprocessed items; delete the access item last. It is not atomic, but if it fails midway
   the access item is still there, so the caller can retry the same `DELETE` and finish it.
   (Deleting the access item first would make a failed delete unretryable and leave
   orphaned tasks.)
6. **Task writes:** create, delete and complete/uncomplete use `TransactWriteItems` with the
   task write plus an `ADD` on the `META` counters, so progress never drifts. The condition on
   `META` (`attribute_exists(PK)`) also rejects writes to a deleted list. Editing a title
   only touches the task item.

## Consequences
- Positive: one or two requests per screen, no fan-out on rename or task changes when
  sharing arrives in v0.3, and USD 0 at portfolio usage.
- Negative / trade-offs:
  - 5 WCU is low. Transactions cost 2 WCU per item, so a task write costs about 4 WCU, and
    deleting a list with many tasks consumes 1 WCU per item. Bursts above the provisioned rate
    rely on DynamoDB burst capacity (up to 300 seconds of unused capacity) and SDK retries;
    sustained bursts are throttled (`ProvisionedThroughputExceededException`), which the
    `dynamodb-throttling` runbook will cover.
  - "My lists" takes two requests instead of one.
  - No PITR and no backups: data loss is possible and accepted.
  - List delete is eventually complete, not atomic.
- What needs revisiting, and when:
  - Switch to on-demand (one change, allowed once every 24 hours) if throttling shows up in
    real use and the cost is accepted.
  - Enable PITR if the app ever holds data worth paying to keep.
  - Evaluate a GSI if "search lists by name" appears, sizing its capacity within the same
    free tier.

## SAA-C03 relevance
DynamoDB modeling by access pattern, provisioned vs on-demand capacity, burst capacity and
throttling, transactions and their WCU cost, PITR, deletion protection, GSI/LSI.
