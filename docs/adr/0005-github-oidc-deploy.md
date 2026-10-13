# ADR-0005: Deploy from GitHub Actions with OIDC instead of stored access keys

- **Status:** Accepted
- **Date:** 2026-10-13

## Context
v0.1 ends with automatic deploys from `main`: the pipeline has to update the Lambda code,
sync the static export to S3 and invalidate CloudFront, so GitHub Actions needs AWS
credentials. The repository is a solo portfolio project with no secrets manager and no
budget for anything with a fixed charge, and whatever grants write access to production
must be scoped as tightly as the deploy itself.

## Options considered
1. **IAM user with access keys stored as GitHub secrets:** simplest to set up and works
   with any tool. Cons: the keys are long-lived, so a leak (workflow log, compromised
   action, fork misconfiguration) stays valid until someone notices and rotates them;
   rotation is manual; the keys work from anywhere, not only from this repository's
   workflows; and it goes against the IAM guidance of preferring temporary credentials.
2. **OIDC federation with an IAM role restricted to the `production` environment:** GitHub
   issues a signed OIDC token per job and AWS STS exchanges it for credentials that expire
   after the job (`sts:AssumeRoleWithWebIdentity`). The role's trust policy pins the token's
   `aud` to `sts.amazonaws.com` and its `sub` to
   `repo:<owner>@<owner-id>/<repo>@<repo-id>:environment:production` (GitHub's immutable
   subject format, which includes the numeric owner and repository IDs). Cons: more moving parts to set up (identity
   provider, trust policy, environment), and a mismatch in the `sub` condition fails with an
   opaque authorization error.
3. **OIDC role trusted by branch (`ref:refs/heads/main`) instead of environment:** same
   mechanism, slightly less setup. Cons: any workflow running on `main` can assume the role,
   and there is no place to add deployment protection rules later.

## Decision
We chose **OIDC federation with a role trusted only by the `production` environment**
because it removes long-lived AWS credentials from GitHub entirely, at no cost. Binding the
trust to the environment rather than the branch means only jobs that explicitly declare
`environment: production` can obtain credentials, and GitHub environment rules (restrict to
`main`, required reviewers) can gate deploys without touching IAM. The trust uses the
immutable subject format, so it stays bound to this exact repository even if the owner or
repository name is later renamed and reused by someone else. The role's permissions
are limited to what the deploy runs: write to the frontend bucket, invalidate the
distribution and update the function code.

## Consequences
- Positive: nothing to rotate or leak; credentials are short-lived and only obtainable from
  this repository's `production` environment; every assumption is recorded in CloudTrail with
  the repository and workflow in the session context.
- Negative / trade-offs: the identity provider and the role are two more clickops resources
  to track in the infra inventory until the Terraform migration; the deploy job must keep
  `environment: production` and `id-token: write`, or the role assumption fails; the trust
  policy must be written with the numeric IDs, since the plain `repo:<owner>/<repo>` form no
  longer matches the token (this broke the first deploy); deploys depend on GitHub's OIDC
  endpoint being available.
- What needs revisiting, and when: when more environments appear (e.g. staging), add one role
  per environment rather than widening this trust policy; in v0.5 the provider, role and
  policies move to Terraform.

## SAA-C03 relevance
Design secure architectures: IAM roles versus IAM users, temporary credentials through STS,
web identity federation (`AssumeRoleWithWebIdentity`), trust policies with condition keys and
least-privilege permissions policies.
