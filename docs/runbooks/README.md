# Runbooks

Operational procedures: what to do when something happens. One file per scenario.

Suggested format:
1. **Symptom / alarm** that triggers the runbook
2. **User impact**
3. **Diagnosis:** commands and queries (CloudWatch Logs Insights, `aws` CLI)
4. **Mitigation:** step by step
5. **Escalation / post-incident:** open a postmortem in `docs/postmortems/`

Available:
- [`ci-cd.md`](ci-cd.md): pipeline configuration, expected variables and failed deploys
- [`infra-inventory.md`](infra-inventory.md): every resource created manually

Planned examples:
- `deploy-rollback.md`
- `api-high-5xx.md`
- `dynamodb-throttling.md`
