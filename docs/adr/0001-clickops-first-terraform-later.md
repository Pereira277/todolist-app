# ADR-0001: Console (clickops) first, Terraform in a separate repository later

- **Status:** Accepted
- **Date:** 2026-10-10

## Context
One goal is learning AWS services for the SAA-C03. Creating resources through the console exposes every option of each service, which helps with the exam. However, manual infrastructure is neither reproducible nor a DevOps portfolio piece.

## Options considered
1. **Terraform from day one:** reproducible, but hides console options and delays the first delivery.
2. **Clickops first, Terraform later:** learn the service first, then codify what is already understood.

## Decision
Option 2. In versions v0.1–v0.4, infrastructure is created through the console and **every resource is recorded in `docs/runbooks/infra-inventory.md`**. In v0.5 everything moves to Terraform in a separate repository (`todolist-infra`), using `terraform import` where it makes sense.

## Consequences
- Positive: deep understanding of each service; the migration becomes a real import exercise.
- Negative: risk of drift and forgotten resources generating cost. Mitigation: mandatory inventory and AWS Budgets.

## SAA-C03 relevance
Configuration knowledge of S3, CloudFront, Cognito, API Gateway, Lambda and DynamoDB.
