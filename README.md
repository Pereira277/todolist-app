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
# frontend (first run: copy .env.example to .env.local and fill in the Cognito IDs and the API URL)
cd frontend && npm install && npm run dev
# static export (output goes to frontend/out)
cd frontend && npm run build
# backend (tests)
cd backend && npm install && npm test
```

## Deploying (manual)
Infrastructure is clickops in v0.1–v0.4 (see ADR-0001); the frontend and the backend are
deployed by hand until CI/CD lands.

### Frontend
```bash
cd frontend && npm run build
aws s3 sync out/ s3://todolist-frontend-lp2779/ --delete
aws cloudfront create-invalidation --distribution-id E13970XDCS5NZM --paths "/*"
```

### Backend (Lambda)
`npm run package` bundles the handler with esbuild into `backend/dist/me.mjs` and zips it as
`backend/dist/me.zip`; the zip is then uploaded to the `todolist-me` function. The HTTP API
stage auto-deploys, so nothing has to be redeployed on the API Gateway side.
```bash
cd backend && npm ci && npm test && npm run package
aws lambda update-function-code --function-name todolist-me \
  --zip-file fileb://dist/me.zip --region us-east-1
aws lambda wait function-updated --function-name todolist-me --region us-east-1
# smoke test: a request without a token must be rejected by the authorizer
curl -i https://1vdohdj087.execute-api.us-east-1.amazonaws.com/me   # expect 401
```
