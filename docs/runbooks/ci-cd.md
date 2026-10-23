# CI/CD pipeline

How the GitHub Actions pipeline is wired, what it expects to be configured outside the
repository, and what to do when a deploy fails.

## Workflows
| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| CI | `.github/workflows/ci.yml` | Pull requests, pushes to `main` | Frontend: lint and build. Backend: lint, typecheck, tests and package. No AWS access |
| Deploy | `.github/workflows/deploy.yml` | Pushes to `main`, manual run (`workflow_dispatch`) | Tests and builds both packages, updates the code of every Lambda function, syncs the static export to S3, invalidates CloudFront and smoke tests the API (`GET /me`, `GET /lists` and `GET /lists/{id}/tasks` without a token must return 401) |

Deploy runs are serialized (`concurrency: deploy-production`): a second push waits for the
running deploy instead of cancelling it.

## Variables
All values are GitHub Actions **variables** (Settings → Secrets and variables → Actions →
Variables), not secrets: none of them is confidential, and the pipeline stores no AWS access
keys. They can live at the repository level or in the `production` environment.

| Variable | Used for | Example |
|----------|----------|---------|
| `AWS_ROLE_ARN` | IAM role assumed through OIDC | `arn:aws:iam::<account-id>:role/<deploy-role>` |
| `AWS_REGION` | Region of the bucket and the functions | `us-east-1` |
| `S3_BUCKET` | Bucket that receives the static export (name only, no `s3://`) | `<frontend-bucket>` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Distribution invalidated after the sync | `E1234567890ABC` |
| `LAMBDA_FUNCTION_NAME` | Function updated with `dist/me.zip` | `todolist-me` |
| `LISTS_FUNCTION_NAME` | Function updated with `dist/lists.zip` | `todolist-lists` |
| `TASKS_FUNCTION_NAME` | Function updated with `dist/tasks.zip` | `todolist-tasks` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Baked into the frontend build | `us-east-1_XXXXXXXXX` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Baked into the frontend build | `<app-client-id>` |
| `NEXT_PUBLIC_API_URL` | Baked into the frontend build and used by the smoke test (no trailing slash) | `https://<api-id>.execute-api.us-east-1.amazonaws.com` |

The CI workflow needs none of them: it builds the frontend with placeholder values.

## GitHub configuration
- **Environment `production`:** the deploy job targets it, so it must exist (Settings →
  Environments). Optional protection rules (required reviewers, restricting it to `main`) apply
  to every deploy.
- **Branch protection on `main`:** require a pull request and the status checks `Frontend` and
  `Backend` from the CI workflow.

## AWS configuration (OIDC)
The deploy job authenticates with short-lived credentials from `sts:AssumeRoleWithWebIdentity`;
there are no long-lived keys to rotate or leak (see ADR-0005).

1. **Identity provider:** `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. **Deploy role trust policy:** it must match the token's `sub` claim exactly. Two things
   shape that value:
   - The job runs in an environment, so the claim ends in `:environment:production` (not the
     `ref:refs/heads/main` form).
   - The repository uses GitHub's immutable subject claims, so the owner and the repository
     carry their numeric IDs: `repo:<owner>@<owner-id>/<repo>@<repo-id>`. A trust policy
     written with the plain `repo:<owner>/<repo>` form is rejected. The IDs keep the trust
     bound to this repository even if the owner or repository name is ever reused.

   The exact prefix in use can be read with
   `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` (`sub_claim_prefix`).
   ```json
   {
     "Effect": "Allow",
     "Principal": { "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com" },
     "Action": "sts:AssumeRoleWithWebIdentity",
     "Condition": {
       "StringEquals": {
         "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
         "token.actions.githubusercontent.com:sub": "repo:<owner>@<owner-id>/<repo>@<repo-id>:environment:production"
       }
     }
   }
   ```
3. **Deploy role permissions (least privilege):**

   | Action | Resource | Needed by |
   |--------|----------|-----------|
   | `s3:ListBucket` | The frontend bucket | `aws s3 sync` (diffing) |
   | `s3:PutObject`, `s3:DeleteObject` | Objects in the frontend bucket | `aws s3 sync` uploads and the `--delete` of stale pages |
   | `cloudfront:CreateInvalidation` | The distribution | Cache invalidation |
   | `lambda:UpdateFunctionCode`, `lambda:GetFunctionConfiguration` | The `todolist-me`, `todolist-lists` and `todolist-tasks` functions | Code update and `aws lambda wait function-updated` |

## Cache headers
| Objects | `Cache-Control` | Why |
|---------|-----------------|-----|
| `_next/static/*` | `public,max-age=31536000,immutable` | File names contain a content hash, so a new build produces new URLs |
| Everything else (HTML, route payloads, favicon) | `public,max-age=0,s-maxage=86400` | Stable URLs. `max-age=0` makes browsers revalidate on every request; `s-maxage` lets CloudFront keep the object for a day, and the invalidation at the end of each deploy purges the edge |

Hashed assets are synced **without** `--delete`: a tab opened before a deploy still requests
the previous build's files, and removing them would break it until a reload. The second sync
(`--exclude "_next/static/*" --delete`) still removes every other object that is no longer in
the build. The trade-off is that old assets accumulate under `_next/static/`; they are small,
but can be pruned by hand (or with an S3 lifecycle rule later) if the bucket grows.

## When a deploy fails
1. **Symptom:** the Deploy workflow is red on `main`.
2. **User impact:** depends on the failing step. Before "Configure AWS credentials" nothing was
   changed. After "Update Lambda code" the API runs the new code while the site may still be the
   previous one.
3. **Diagnosis:** open the failed run (`gh run list --workflow deploy.yml`, then
   `gh run view <id> --log-failed`).
   - "Configure AWS credentials" fails with `Not authorized to perform
     sts:AssumeRoleWithWebIdentity`: the trust policy `sub` does not match, or `AWS_ROLE_ARN` is
     wrong. Compare the trust policy with the `sub_claim_prefix` returned by the command in
     "AWS configuration" plus `:environment:production`; the usual cause is a policy written
     without the numeric owner and repository IDs.
   - `AccessDenied` on a later step: the role is missing one of the permissions above.
   - "Smoke test" fails: the API did not answer 401 without a token; check the route, the
     authorizer and `NEXT_PUBLIC_API_URL`.
4. **Mitigation:** fix the cause and re-run the workflow (`gh workflow run deploy.yml`), or
   revert the offending commit on `main` through a pull request, which deploys the previous
   code again. The manual commands in the README remain as a fallback.
5. **Post-incident:** if users were affected, open a postmortem in `docs/postmortems/`.
