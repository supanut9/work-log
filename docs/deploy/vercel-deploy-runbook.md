# Vercel Deploy Runbook

This tracked companion preserves the workspace runbook at `../docs/deploy/vercel-deploy-runbook.md` in git. Keep both files aligned until the workspace root becomes a tracked repo.

Use this runbook for Vercel projects under `/Users/supanut.tan/projects/supanut9`.

## Account And Naming

- Vercel CLI account: `supanut9`
- Vercel team scope shown by CLI: `supanut9s-projects`
- GitHub account/remotes: `supanut9`
- Preferred new project name: `supanut9-<product>-<service>`
- Preferred public Vercel domain: `supanut9-<product>-<service>.vercel.app`

Some existing projects predate the naming rule. Do not rename them casually because aliases, GitHub integration, and environment variables may already depend on the current project identity.

## Current Vercel Inventory

Observed with `vercel project list` on 2026-05-22.

| Local directory | Vercel project | Latest production URL | Runtime shape |
| --- | --- | --- | --- |
| `auth-server` | `supanut9-auth-server` | `https://supanut9-auth-server.vercel.app` | Go/function-shaped auth API |
| `auth-ui` | `supanut9-auth-ui` | `https://supanut9-auth-ui.vercel.app` | Hosted auth UI |
| `interview-api` | `supanut9-interview-api` | `https://supanut9-interview-api.vercel.app` | API on Vercel with Neon |
| `interview-web` | `interview-web` | `https://interview-web-beta.vercel.app` | Next.js web |
| `language-api` | `supanut9-language-api` | `https://supanut9-language-api.vercel.app` | Go/function-shaped API |
| `language-web` | `supanut9-language-web` | `https://supanut9-language-web.vercel.app` | Web app |
| `community-api` | `supanut9-community-api` | `https://supanut9-community-api.vercel.app` | API |
| `community-web` | `community-web` | `https://supanut9-community-web.vercel.app` | Web app |
| `knowledge-api` | `knowledge-api` | `https://knowledge-api-supanut9s-projects.vercel.app` | Go/function-shaped API |
| `knowledge-web` | `knowledge-web` | `https://supanut9-knowledge-web.vercel.app` | Web app |
| `portal-api` | `portal-api` | `https://supanut9-portal-api.vercel.app` | API |
| `portal-web` | `portal-web` | `https://supanut9-portal-web.vercel.app` | Web app |

## Core Flow

1. Confirm `vercel whoami` returns `supanut9`.
2. Confirm Git remotes point at `github.com/supanut9/...`.
3. Confirm `.vercel/project.json` points at the intended project.
4. List env names with `vercel env ls --cwd <repo> --format json`; do not print secret values.
5. Add or replace env vars through Vercel CLI/dashboard.
6. Deploy preview with `vercel deploy --cwd <repo> -y`.
7. Deploy production only when requested: `vercel deploy --prod --cwd <repo> -y`.
8. Inspect the exact deployment: `vercel inspect <deployment-url> --cwd <repo>`.
9. Alias the ready deployment to the stable `supanut9-...vercel.app` domain when needed.
10. Run browser and API smoke checks.
11. Record evidence and blockers in `work-log`.

## Commands

```sh
vercel link --cwd <repo> --yes --project <vercel-project-name>
vercel env ls --cwd <repo> --format json
printf '%s' "$VALUE" | vercel env add NAME production --cwd <repo>
vercel env rm NAME production --cwd <repo> --yes
vercel deploy --cwd <repo> -y
vercel deploy --prod --cwd <repo> -y
vercel inspect <deployment-url> --cwd <repo>
vercel alias set <ready-deployment-url> supanut9-<product>-<service>.vercel.app
```

For Next.js prebuilt production deploys:

```sh
vercel pull --cwd <repo> --yes --environment=production
vercel build --cwd <repo> --prod
vercel deploy --cwd <repo> --prebuilt --prod
```

## Known Workspace Pitfalls

- Vercel deployments reporting `UNKNOWN` or `BLOCKED` are not release evidence.
- Public apps can be blocked by Vercel SSO/deployment protection. Inspect with `vercel api /v9/projects/<project> --raw`.
- If a public app is intentionally public, SSO protection may need to be disabled with `{"ssoProtection":null}`.
- Stable aliases can keep pointing at an older ready deployment while newer deploys fail.
- Neon database URLs are secrets. Do not print them. Use Neon-compatible migration paths when local `pg` tooling times out against pooled URLs.
- Auth client callback URLs must use the final deployed web origin, not a generated source deployment URL.
- Production AI provider traffic stays off unless explicitly approved with provider credentials and budget.

## Verification

- Stable URL loads in a browser and does not redirect to Vercel login.
- `vercel inspect <stable-domain>` reports a ready deployment.
- API health endpoints return `200`.
- Auth discovery/JWKS endpoints report deployed issuer URLs.
- Login redirects through `auth-server` and returns to the deployed app.
- Authenticated API reads and writes use the expected subject.
- Database-backed state persists after refresh.
- Browser console has no unexpected errors.

## Closeout

After meaningful deploy work:

- Commit and push changed product repos.
- Update service-specific hosting docs.
- Add a `work-log` entry with verification, commit, push result, next plan, and blockers.
- Refresh reports if repo status changed.
- Commit and push `work-log`.
