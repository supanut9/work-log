# Supanut9 Work Log

This repository tracks selected projects under `/Users/supanut.tan/projects/supanut9`.

The workspace root stays non-git. This nested repo owns progress logs, repo status reports, machine-readable stats, and tracker rules.

## Quick Start

```sh
npm run scan
npm run report
npm run log:add -- --project work-log --tags tracker --summary "Updated tracker" --verification "reviewed files" --commit "pending" --push "pending" --next-plan "continue" --blockers "none"
```

Optional local database:

```sh
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run report:db
npm run db:summary
npm run log:add -- --project work-log --tags tracker,db --summary "Recorded tracker work" --verification "npm run db:migrate" --commit "pending" --push "pending" --next-plan "commit tracker" --blockers "none" --db
```

Use `npm run report` for a file-only refresh. Use `npm run report:db` when the local Postgres container is running and snapshots should be stored in `repo_snapshots`.

## Rules

- `config/projects.yml` is the allowlist for tracked projects.
- Do not infer tracking from every folder in the root workspace.
- Commit tracker changes in this repo, not at the workspace root.
- Keep daily human logs in `logs/daily/`, generated human reports in `reports/`, and machine stats in `stats/`.
- Use PostgreSQL as the query source once the runtime DB is started.

## Daily Logs

Use `npm run log:add` for normal entries:

```sh
npm run log:add -- --project language-api --tags backend,course --summary "Committed course readiness work" --verification "go test ./..." --commit "8a66f96 feat: add conversation and course readiness" --push "not pushed" --next-plan "continue LANG-101" --blockers "none" --db
```

Omit `--db` only when Postgres is not running. The command validates the project id against `config/projects.yml`, writes the markdown log, and inserts into `log_entries` when `--db` is present.

Manual files still use one file per date:

```text
logs/daily/YYYY-MM-DD.md
```

Each daily file is newest-first and starts with a table of contents:

```md
# 2026-05-21 Work Log

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

Add a daily log entry after meaningful work in an enabled project: commits, pushes, verification runs, task-board or phase-doc updates, and blockers that affect continuation.

After tracked repo status changes, refresh `reports/current.md` and `stats/current.json` with `npm run report` or `npm run report:db`.

## Useful Queries

```sh
docker compose exec -T postgres psql -U work_log -d work_log -c "select count(*) from repo_snapshots;"
docker compose exec -T postgres psql -U work_log -d work_log -c "select project_id, dirty_files, ahead, behind, fetch_status from repo_snapshots order by captured_at desc;"
```
