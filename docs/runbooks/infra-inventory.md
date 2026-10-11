# Infrastructure inventory (clickops)

> Every resource created manually in the console **must** be recorded here (ADR-0001). This is the baseline for the Terraform migration in v0.5.

**Default region:** us-east-1 (Budgets and Cost Anomaly Detection are global)

| Date | Service | Name/ID | Relevant configuration | Expected cost | Version |
|------|---------|---------|------------------------|---------------|---------|
| 2026-10-11 | AWS Budgets | todolist-budget | Monthly cost budget, USD 5, all services. Alerts by email: actual 20% (USD 1), actual 100% (USD 5), forecasted 100% | USD 0 | v0.1 |
| 2026-10-11 | Cost Anomaly Detection | Default-Services-Monitor | Monitor type: AWS services | USD 0 | v0.1 |
| 2026-10-11 | Cost Anomaly Detection | todolist-anomalies | Alert subscription, individual alerts, absolute impact > USD 1, email | USD 0 | v0.1 |
