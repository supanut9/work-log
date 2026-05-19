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
4. Update logs/reports after meaningful work in tracked projects.
5. Commit this repo with tracker-action scopes.

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

