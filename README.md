# Supanut9 Work Log

This repository tracks selected projects under `/Users/supanut.tan/projects/supanut9`.

The workspace root stays non-git. This nested repo owns progress logs, repo status reports, machine-readable stats, and tracker rules.

## Quick Start

```sh
npm run scan
npm run report
```

Optional local database:

```sh
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run report:db
npm run db:summary
```

Use `npm run report` for a file-only refresh. Use `npm run report:db` when the local Postgres container is running and snapshots should be stored in `repo_snapshots`.

## Rules

- `config/projects.yml` is the allowlist for tracked projects.
- Do not infer tracking from every folder in the root workspace.
- Commit tracker changes in this repo, not at the workspace root.
- Keep daily human logs in `logs/daily/`, generated human reports in `reports/`, and machine stats in `stats/`.
- Use PostgreSQL as the query source once the runtime DB is started.

## Daily Logs

Use one file per date:

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
