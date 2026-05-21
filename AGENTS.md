# AGENTS.md

This repo is the durable work-log tracker for `/Users/supanut.tan/projects/supanut9`.

## Scope

- Track only projects listed in `config/projects.yml`.
- Keep the workspace root non-git.
- Do not treat every sibling folder as active work.
- Do not commit local PostgreSQL data, `.env`, caches, or agent runtime state.

## Default Workflow

1. Read `config/projects.yml`.
2. Run `npm run report` before broad coordination work.
3. Check `reports/current.md` and `stats/current.json`.
4. After meaningful work in a tracked project, update the daily log with `npm run log:add`.
5. If tracked repo status changed, refresh reports with `npm run report` or `npm run report:db`.
6. Commit this repo with tracker-action scopes.

## When To Add A Log Entry

Add a log entry with `npm run log:add` whenever an enabled project has meaningful work, especially after:

- a product repo commit is created
- a push succeeds or is intentionally deferred
- verification is run for a repo slice
- a task board, phase doc, or closeout doc is updated
- a blocker, failed hook, failed CI/check, missing remote, or dirty-work decision affects next steps
- work spans multiple repos and future agents need the cross-repo context

Do not log every tiny file edit. Log stable work boundaries that another agent would need in order to continue safely.

Use manual log edits only for repairing older entries or reshaping history. For normal work closeout, use the CLI so project ids are validated and DB storage can be kept in sync.

## Daily Log Format

Use one file per date:

```text
logs/daily/YYYY-MM-DD.md
```

Each daily file must be newest-first and include a table of contents:

```md
# YYYY-MM-DD Work Log

## Table Of Contents

| Time | Repo | Tags | Summary |
| --- | --- | --- | --- |
| 15:10 | `work-log` | `tracker`, `db` | Refreshed DB-backed workspace report |

## 15:10 - work-log

- Repo: `work-log`
- Tags: `tracker`, `db`
- Summary: Refreshed DB-backed workspace report.
- Verification: `npm run report:db`; `npm run db:summary`
- Commit: `abc1234 docs: refresh db-backed workspace report`
- Push: pushed to `origin/main`
- Next plan: use report queues for repo cleanup
- Blockers: none
```

Preferred command:

```sh
npm run log:add -- --project language-api --tags backend,course --summary "Committed course readiness work" --verification "go test ./..." --commit "8a66f96 feat: add conversation and course readiness" --push "not pushed" --next-plan "continue LANG-101" --blockers "none" --db
```

Omit `--db` only when Postgres is not running. The command creates or updates `logs/daily/YYYY-MM-DD.md`; with `--db`, it also inserts a row into `log_entries`.

For multi-repo work, either create one entry per repo at the same timestamp or use a combined repo value such as `language-api`, `language-web` when the work is intentionally cross-repo.

## Report Refresh Rule

Run `npm run report` after committing tracked project work that changes dirty/ahead/behind status.

Use `npm run report:db` instead when the local Postgres container is running and DB snapshots should be updated.

Commit the log/report refresh separately from the product repo commit.

## Commit Format

Use:

```text
type(tracker-action): [target-repo] [CARD-ID] outcome
```

Allowed tracker-action scopes:

```text
record
refresh
tag
plan
report
rules
config
registry
journal
stats
```

Examples:

```text
docs(report): [all] [WORKLOG-001] add initial workspace dashboard
chore(config): [work-log] [WORKLOG-001] seed tracked project allowlist
docs(record): [language-api] [LANG-090] record conversation coach work
```
