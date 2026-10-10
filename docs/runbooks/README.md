# Runbooks

Operational procedures: what to do when something happens. One file per scenario.

Suggested format:
1. **Symptom / alarm** that triggers the runbook
2. **User impact**
3. **Diagnosis:** commands and queries (CloudWatch Logs Insights, `aws` CLI)
4. **Mitigation:** step by step
5. **Escalation / post-incident:** open a postmortem in `docs/postmortems/`

Planned examples:
- `deploy-rollback.md`
- `api-high-5xx.md`
- `dynamodb-throttling.md`
