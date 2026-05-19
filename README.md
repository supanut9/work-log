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
```

## Rules

- `config/projects.yml` is the allowlist for tracked projects.
- Do not infer tracking from every folder in the root workspace.
- Commit tracker changes in this repo, not at the workspace root.
- Keep generated human reports in `reports/` and machine stats in `stats/`.
- Use PostgreSQL as the query source once the runtime DB is started.

