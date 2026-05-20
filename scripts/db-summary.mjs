import { queryJson } from "./db-psql.mjs";

const summary = queryJson(`
with latest as (
  select distinct on (project_id)
    project_id,
    dirty_files,
    ahead,
    behind,
    has_origin,
    fetch_status
  from repo_snapshots
  order by project_id, captured_at desc
)
select json_build_object(
  'projects', (select count(*) from projects where enabled = true),
  'latest_snapshots', (select count(*) from latest),
  'dirty_projects', (select count(*) from latest where dirty_files > 0),
  'commits_left_to_push_projects', (select count(*) from latest where coalesce(ahead, 0) > 0 and coalesce(behind, 0) = 0),
  'behind_projects', (select count(*) from latest where coalesce(behind, 0) > 0),
  'divergent_projects', (select count(*) from latest where coalesce(ahead, 0) > 0 and coalesce(behind, 0) > 0),
  'missing_origin_projects', (select count(*) from latest where fetch_status = 'missing_origin'),
  'fetch_failed_projects', (select count(*) from latest where fetch_status like 'failed:%'),
  'no_task_board_projects', (select count(*) from projects where enabled = true and task_board is null),
  'no_phase_docs_projects', (select count(*) from projects where enabled = true and jsonb_array_length(phase_docs) = 0)
);
`);

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
