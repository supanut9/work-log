import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { queryJson } from "./db-psql.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const statsPath = path.join(repoRoot, "stats", "current.json");

function parseArgs(argv) {
  const args = { staleDays: 3 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--stale-days") {
      const value = Number.parseInt(argv[index + 1], 10);
      if (!Number.isFinite(value) || value < 1) throw new Error("Invalid --stale-days value");
      args.staleDays = value;
      index += 1;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

function loadStats() {
  return JSON.parse(readFileSync(statsPath, "utf8"));
}

function attentionLabel(project) {
  if (!project.exists) return "missing path";
  if (project.fetch_status?.startsWith("failed:")) return "fetch failed";
  if (project.fetch_status === "missing_origin") return "missing origin";
  if (project.ahead > 0 && project.behind > 0) return `divergent: ${project.ahead} ahead, ${project.behind} behind`;
  if (project.behind > 0) return `behind origin by ${project.behind}`;
  if (project.dirty_files > 0 && project.ahead > 0) return `dirty and ${project.ahead} ahead`;
  if (project.dirty_files > 0) return `dirty: ${project.dirty_files} file${project.dirty_files === 1 ? "" : "s"}`;
  return "";
}

function pushLabel(project) {
  return `${project.ahead} commit${project.ahead === 1 ? "" : "s"} ahead; policy ${project.push_policy || "unknown"}`;
}

function line(project, detail) {
  return `- ${project.id}: ${detail}`;
}

function section(title, rows) {
  const body = rows.length ? rows.join("\n") : "- none";
  return `\n## ${title}\n${body}`;
}

function todayDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function tryQuery(sql) {
  try {
    return queryJson(sql);
  } catch {
    return null;
  }
}

function loadTodayLogs() {
  const date = todayDate();
  return (
    tryQuery(`
select coalesce(json_agg(json_build_object(
  'project_id', project_id,
  'log_time', log_time,
  'summary', summary,
  'push_status', push_status
) order by log_time desc, project_id), '[]'::json)
from log_entries
where log_date = ${sqlString(date)};
`) || []
  );
}

function loadStaleProjects(staleDays) {
  return (
    tryQuery(`
with latest_logs as (
  select project_id, max(logged_at) as latest_log_at
  from log_entries
  group by project_id
)
select coalesce(json_agg(json_build_object(
  'project_id', p.id,
  'latest_log_at', latest_logs.latest_log_at
) order by latest_logs.latest_log_at nulls first, p.id), '[]'::json)
from projects p
left join latest_logs on latest_logs.project_id = p.id
where p.enabled = true
  and (latest_logs.latest_log_at is null or latest_logs.latest_log_at < now() - (${sqlString(`${staleDays} days`)})::interval);
`) || []
  );
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stats = loadStats();
  const projects = stats.projects || [];

  const attention = projects
    .map((project) => ({ project, label: attentionLabel(project) }))
    .filter((item) => item.label)
    .sort((left, right) => left.project.id.localeCompare(right.project.id))
    .map((item) => line(item.project, item.label));

  const readyToPush = projects
    .filter((project) => project.is_git_repo && project.has_origin && project.dirty_files === 0 && project.ahead > 0 && (project.behind || 0) === 0)
    .sort((left, right) => right.ahead - left.ahead || left.id.localeCompare(right.id))
    .map((project) => line(project, pushLabel(project)));

  const trackingGaps = projects
    .filter((project) => !project.task_board || !project.phase_docs?.length)
    .sort((left, right) => left.product.localeCompare(right.product) || left.id.localeCompare(right.id))
    .map((project) => {
      const gaps = [];
      if (!project.task_board) gaps.push("no task board");
      if (!project.phase_docs?.length) gaps.push("no phase docs");
      return line(project, gaps.join(", "));
    });

  const todayLogs = loadTodayLogs().map((entry) => `- ${entry.log_time} ${entry.project_id}: ${entry.summary} (${entry.push_status})`);
  const staleProjects = loadStaleProjects(args.staleDays).map((entry) => {
    const last = entry.latest_log_at ? `last log ${entry.latest_log_at}` : "no log entries";
    return `- ${entry.project_id}: ${last}`;
  });

  process.stdout.write(`# Work Queue\n`);
  process.stdout.write(`Captured: ${stats.captured_at}\n`);
  process.stdout.write(`Source: ${stats.source}\n`);
  process.stdout.write(section("Needs Attention", attention));
  process.stdout.write(section("Ready To Push", readyToPush));
  process.stdout.write(section("Tracking Gaps", trackingGaps));
  process.stdout.write(section(`Stale Logs (${args.staleDays}+ days)`, staleProjects));
  process.stdout.write(section("Today", todayLogs));
  process.stdout.write("\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
