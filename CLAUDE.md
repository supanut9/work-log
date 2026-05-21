# CLAUDE.md

This is the tracker repo for the Supanut9 workspace. Follow `AGENTS.md` first.

- Read `config/projects.yml` before deciding what is tracked.
- Use `npm run report` to refresh the dashboard.
- Store durable human output in `reports/` and `logs/`.
- Store machine-readable output in `stats/`.
- Do not modify sibling product repos while updating tracker files unless the user asked for that product work.
- After meaningful work in an enabled project, add an entry with `npm run log:add`.
- Daily logs must be newest-first and start with a table of contents listing time, repo, tags, and summary.
- Add a log entry after product commits, pushes, verification runs, task-board/phase-doc updates, or blockers that affect continuation.
- Use `--db` with `npm run log:add` when local Postgres is running so `log_entries` stays queryable.
- If tracked repo status changed, run `npm run report` or `npm run report:db` and commit the tracker update separately.
