# ADR-0002: DynamoDB single-table design

- **Status:** Proposed (confirm in v0.2)
- **Date:** 2026-10-10

## Context
We need to store lists, tasks and who can access each list. The main access patterns are:
1. List every list a user can see (owned and shared)
2. Open a list with all of its tasks
3. Check whether a user has permission on a list

## Options considered
1. **One table per entity (Lists, Tasks, Shares):** familiar, but each screen needs several queries.
2. **Single table with composite PK/SK:** each access pattern becomes a single `Query`.
3. **RDS/Aurora:** relational modeling is easy, but costly outside the free tier and not truly serverless.

## Decision
Option 2 (see the model in `docs/architecture.md`), with **on-demand** billing.

## Consequences
- Positive: one query per screen, near-zero cost, strong NoSQL modeling practice.
- Negative: the list name is duplicated in access items (must be updated on rename); steeper learning curve.
- Revisit: if "search lists by name" appears, evaluate a GSI.

## SAA-C03 relevance
DynamoDB modeling, on-demand vs provisioned capacity, GSI/LSI, choosing a database by access pattern.
