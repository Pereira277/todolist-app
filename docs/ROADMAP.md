# Roadmap

Each version = one GitHub **Milestone**. Every version ends **deployed and working**.

| Version | Theme | Deliverable | Status |
|---------|-------|-------------|--------|
| v0.1 | Foundation + Auth | Cognito sign-in → "Hello, {name}" page on S3 + CloudFront, with CI/CD | ✅ Done |
| v0.2 | Personal lists | List and task CRUD (API Gateway + Lambda + DynamoDB) | 🔜 Next |
| v0.3 | **MVP: sharing** | Share by email, viewer/editor permissions, revoke | ⏳ |
| v0.4 | SRE: observability | SLIs/SLOs, burn-rate alarms, X-Ray, dashboard | ⏳ |
| v0.5 | Infrastructure as code | Migrate clickops → Terraform (separate repository) | ⏳ |

## SAA-C03 domains by version
- **Secure architectures:** v0.1 (Cognito, IAM), v0.3 (authorization)
- **Resilient architectures:** v0.4 (monitoring and alarms)
- **High-performing architectures:** v0.2 (DynamoDB modeling)
- **Cost-optimized architectures:** v0.1 (Budgets), plus ADR decisions in every version

> Versions after v0.5 will be planned when v0.4 is done.

## Rules
- A version starts only when the previous one is `Done`.
- New ideas become issues labeled `backlog`, with no milestone.
