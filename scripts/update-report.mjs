import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { collect } from "./scan-repos.mjs";
import { queryJson, runSql } from "./db-psql.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const fetch = process.argv.includes("--fetch");
const writeDb = process.argv.includes("--db");
const capturedAt = new Date().toISOString();
const scannedProjects = collect({ fetch });

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

function attention(project) {
  if (!project.exists) return "missing path";
  if (project.fetch_status.startsWith("failed:")) return "fetch failed";
  if (project.fetch_status === "missing_origin") return "missing origin";
  if (project.ahead > 0 && project.behind > 0) return "divergent";
  if (project.behind > 0) return "behind origin";
  if (project.ahead > 0) return "commits to push";
  if (project.dirty_files > 0) return "dirty";
  if (!project.is_git_repo && project.stats?.includes("git_health")) return "not git";
  return "";
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlNumber(value) {
  return Number.isFinite(value) ? String(value) : "null";
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value ?? []))}::jsonb`;
}

function writeSnapshotsToDb(rows) {
  const statements = [];

  for (const project of rows) {
    statements.push(`insert into projects (
  id,
  path,
  name,
  enabled,
  repo_kind,
  app_kind,
  product,
  branch_policy,
  push_policy,
  milestone_tag_policy,
  task_board,
  phase_docs,
  architecture_docs,
  runbooks,
  tech,
  stats
) values (
  ${sqlString(project.id)},
  ${sqlString(project.path)},
  ${sqlString(project.name)},
  ${sqlBoolean(project.enabled !== false)},
  ${sqlString(project.repo_kind)},
  ${sqlString(project.app_kind)},
  ${sqlString(project.product)},
  ${sqlString(project.branch_policy)},
  ${sqlString(project.push_policy)},
  ${sqlString(project.milestone_git_tags)},
  ${sqlString(project.task_board)},
  ${sqlJson(project.phase_docs)},
  ${sqlJson(project.architecture_docs)},
  ${sqlJson(project.runbooks)},
  ${sqlJson(project.tech)},
  ${sqlJson(project.stats)}
) on conflict (id) do update set
  path = excluded.path,
  name = excluded.name,
  enabled = excluded.enabled,
  repo_kind = excluded.repo_kind,
  app_kind = excluded.app_kind,
  product = excluded.product,
  branch_policy = excluded.branch_policy,
  push_policy = excluded.push_policy,
  milestone_tag_policy = excluded.milestone_tag_policy,
  task_board = excluded.task_board,
  phase_docs = excluded.phase_docs,
  architecture_docs = excluded.architecture_docs,
  runbooks = excluded.runbooks,
  tech = excluded.tech,
  stats = excluded.stats,
  updated_at = now();`);

    statements.push(`delete from project_tags where project_id = ${sqlString(project.id)};`);
    for (const tag of project.tags || []) {
      statements.push(`insert into project_tags (project_id, tag) values (${sqlString(project.id)}, ${sqlString(tag)}) on conflict do nothing;`);
    }

    statements.push(`insert into repo_snapshots (
  id,
  project_id,
  captured_at,
  branch,
  dirty_files,
  ahead,
  behind,
  has_origin,
  fetch_status,
  last_commit_hash,
  last_commit_subject,
  remote_url
) values (
  ${sqlString(randomUUID())},
  ${sqlString(project.id)},
  ${sqlString(capturedAt)},
  ${sqlString(project.branch)},
  ${sqlNumber(project.dirty_files)},
  ${sqlNumber(project.ahead)},
  ${sqlNumber(project.behind)},
  ${sqlBoolean(project.has_origin)},
  ${sqlString(project.fetch_status)},
  ${sqlString(project.last_commit_hash)},
  ${sqlString(project.last_commit_subject)},
  ${sqlString(project.remote_url)}
);`);
  }

  runSql(["begin;", ...statements, "commit;"].join("\n"));
}

function readLatestSnapshotsFromDb() {
  const rows = queryJson(`
with latest as (
  select distinct on (s.project_id)
    p.id,
    p.name,
    p.path,
    p.enabled,
    p.product,
    p.repo_kind,
    p.app_kind,
    p.branch_policy,
    p.push_policy,
    p.milestone_tag_policy,
    p.task_board,
    p.phase_docs,
    p.architecture_docs,
    p.runbooks,
    p.tech,
    p.stats,
    s.captured_at,
    s.branch,
    s.dirty_files,
    s.ahead,
    s.behind,
    s.has_origin,
    s.fetch_status,
    s.last_commit_hash,
    s.last_commit_subject,
    s.remote_url
  from projects p
  join repo_snapshots s on s.project_id = p.id
  where p.enabled = true
  order by s.project_id, s.captured_at desc
),
tag_rows as (
  select project_id, json_agg(tag order by tag) as tags
  from project_tags
  group by project_id
)
select coalesce(json_agg(json_build_object(
  'id', latest.id,
  'name', latest.name,
  'path', latest.path,
  'enabled', latest.enabled,
  'product', latest.product,
  'repo_kind', latest.repo_kind,
  'app_kind', latest.app_kind,
  'branch_policy', latest.branch_policy,
  'push_policy', latest.push_policy,
  'milestone_git_tags', latest.milestone_tag_policy,
  'task_board', latest.task_board,
  'phase_docs', latest.phase_docs,
  'architecture_docs', latest.architecture_docs,
  'runbooks', latest.runbooks,
  'tech', latest.tech,
  'stats', latest.stats,
  'captured_at', latest.captured_at,
  'branch', latest.branch,
  'dirty_files', latest.dirty_files,
  'ahead', latest.ahead,
  'behind', latest.behind,
  'has_origin', latest.has_origin,
  'fetch_status', latest.fetch_status,
  'last_commit_hash', latest.last_commit_hash,
  'last_commit_subject', latest.last_commit_subject,
  'remote_url', latest.remote_url,
  'tags', coalesce(tag_rows.tags, '[]'::json)
) order by latest.id), '[]'::json)
from latest
left join tag_rows on tag_rows.project_id = latest.id;
`);

  return rows.map((project) => ({
    ...project,
    is_git_repo: project.fetch_status !== "not_git",
    exists: project.fetch_status !== "missing_path",
    stats: project.stats ?? [],
  }));
}

function buildStats(rows, source) {
  const enriched = rows.map((project) => ({ ...project, attention: attention(project) }));
  const gitProjects = enriched.filter((project) => project.is_git_repo);

  return {
    captured_at: source === "postgres" ? enriched[0]?.captured_at ?? capturedAt : capturedAt,
    fetch_performed: fetch,
    db_write_performed: writeDb,
    source,
    totals: {
      configured_projects: enriched.length,
      git_projects: gitProjects.length,
      clean_git_projects: countWhere(gitProjects, (project) => project.dirty_files === 0 && project.ahead === 0 && project.behind === 0 && project.fetch_status !== "missing_origin"),
      dirty_projects: countWhere(enriched, (project) => project.dirty_files > 0),
      commits_left_to_push_projects: countWhere(enriched, (project) => project.ahead > 0 && !(project.behind > 0)),
      behind_projects: countWhere(enriched, (project) => project.behind > 0),
      divergent_projects: countWhere(enriched, (project) => project.ahead > 0 && project.behind > 0),
      missing_origin_projects: countWhere(enriched, (project) => project.fetch_status === "missing_origin"),
      fetch_failed_projects: countWhere(enriched, (project) => project.fetch_status.startsWith("failed:")),
      missing_path_projects: countWhere(enriched, (project) => !project.exists),
      no_task_board_projects: countWhere(enriched, (project) => !project.task_board),
      no_phase_docs_projects: countWhere(enriched, (project) => !project.phase_docs?.length),
    },
    projects: enriched,
  };
}

function table(rows) {
  if (rows.length === 0) return "_None._\n";

  const lines = [
    "| Project | Product | Branch | Dirty | Ahead | Behind | Origin | Status |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
  ];

  for (const project of rows) {
    lines.push(`| \`${project.id}\` | ${project.product} | ${project.branch ?? ""} | ${project.dirty_files ?? 0} | ${project.ahead ?? ""} | ${project.behind ?? ""} | ${project.has_origin ? "yes" : "no"} | ${project.attention || "ok"} |`);
  }

  return `${lines.join("\n")}\n`;
}

function groupedNextPlans(enriched) {
  const groups = new Map();
  for (const project of enriched) {
    if (!groups.has(project.product)) groups.set(project.product, []);
    groups.get(project.product).push(project);
  }

  const lines = [];
  for (const [product, productProjects] of [...groups.entries()].sort()) {
    const boards = [...new Set(productProjects.map((project) => project.task_board).filter(Boolean))];
    const phases = [...new Set(productProjects.flatMap((project) => project.phase_docs || []).filter(Boolean))];
    lines.push(`- ${product}: ${productProjects.map((project) => `\`${project.id}\``).join(", ")}.`);
    if (boards.length) lines.push(`  Task board: ${boards.join(", ")}.`);
    if (phases.length) lines.push(`  Phase docs: ${phases.join(", ")}.`);
  }
  return `${lines.join("\n")}\n`;
}

if (writeDb) {
  writeSnapshotsToDb(scannedProjects);
}

const reportRows = writeDb ? readLatestSnapshotsFromDb() : scannedProjects;
const stats = buildStats(reportRows, writeDb ? "postgres" : "scanner");
const enriched = stats.projects;
const needingAttention = enriched.filter((project) => project.attention);
const commitsLeftToPush = enriched.filter((project) => project.ahead > 0 && !(project.behind > 0));
const dirtyWork = enriched.filter((project) => project.dirty_files > 0);
const brokenOrMissingRemotes = enriched.filter((project) => project.fetch_status === "missing_origin" || project.fetch_status.startsWith("failed:"));
const behindOrDivergent = enriched.filter((project) => project.behind > 0);

const report = `# Supanut9 Work Log Current Report

Captured: ${stats.captured_at}

Fetch performed: ${fetch ? "yes" : "no"}

Source: ${stats.source}

## Summary

- Configured projects: ${stats.totals.configured_projects}
- Git projects: ${stats.totals.git_projects}
- Clean git projects: ${stats.totals.clean_git_projects}
- Dirty projects: ${stats.totals.dirty_projects}
- Projects with commits left to push: ${stats.totals.commits_left_to_push_projects}
- Behind origin: ${stats.totals.behind_projects}
- Divergent: ${stats.totals.divergent_projects}
- Missing origin: ${stats.totals.missing_origin_projects}
- Fetch failed: ${stats.totals.fetch_failed_projects}
- Missing paths: ${stats.totals.missing_path_projects}
- No task board: ${stats.totals.no_task_board_projects}
- No phase docs: ${stats.totals.no_phase_docs_projects}

## Repos Needing Attention

${table(needingAttention)}

## Commits Left To Push

${table(commitsLeftToPush)}

## Dirty Work

${table(dirtyWork)}

## Broken Or Missing Remotes

${table(brokenOrMissingRemotes)}

## Behind Or Divergent Repos

${table(behindOrDivergent)}

## Project Progress Sources

${groupedNextPlans(enriched)}

## Next Plans

Use the task boards and phase docs above as the next-plan source. Projects without a task board or phase docs are counted in the summary and should be configured before relying on progress-health statistics.

## All Projects

${table(enriched)}
`;

mkdirSync(path.join(repoRoot, "reports"), { recursive: true });
mkdirSync(path.join(repoRoot, "stats"), { recursive: true });
writeFileSync(path.join(repoRoot, "stats", "current.json"), `${JSON.stringify(stats, null, 2)}\n`);
writeFileSync(path.join(repoRoot, "reports", "current.md"), report);

process.stdout.write(`Wrote reports/current.md and stats/current.json for ${enriched.length} projects${writeDb ? " and stored DB snapshots" : ""}.\n`);
