# Shareable TodoList — Serverless on AWS

A minimal todo app with list sharing between users, built as a hands-on study of **AWS architecture (SAA-C03)** and **SRE practices**.

**Live site:** https://d1sa68e9am4aht.cloudfront.net

## Stack
Next.js (static) · S3 + CloudFront · Cognito · API Gateway · Lambda · DynamoDB · GitHub Actions

## Documentation
| Document | Purpose |
|----------|---------|
| [PRD](docs/PRD.md) | Scope, MVP and what is out of scope |
| [Roadmap](docs/ROADMAP.md) | Versions and progress |
| [Architecture](docs/architecture.md) | Diagram, data model, endpoints |
| [ADRs](docs/adr/) | Architecture decisions and trade-offs |
| [Runbooks](docs/runbooks/) | Operations |
| [Postmortems](docs/postmortems/) | Incidents and lessons learned |

## Workflow
Issue (GitHub Projects) → branch `type/n-slug` → PR with `Closes #n` → CI → squash merge → deploy.

## Running locally
```bash
# frontend
cd frontend && npm install && npm run dev
# static export (output goes to frontend/out)
cd frontend && npm run build
# backend (tests)
cd backend && npm install && npm test
```

## Deploying (manual)
Infrastructure is clickops in v0.1–v0.4 (see ADR-0001); the frontend is deployed by hand
until CI/CD lands.
```bash
cd frontend && npm run build
aws s3 sync out/ s3://todolist-frontend-lp2779/ --delete
aws cloudfront create-invalidation --distribution-id E13970XDCS5NZM --paths "/*"
```
