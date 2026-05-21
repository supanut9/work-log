import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadProjects } from "./scan-repos.mjs";
import { runSql } from "./db-psql.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");
const timeZone = "Asia/Bangkok";

export function parseArgs(argv, booleanKeys = []) {
  const args = {};
  const booleans = new Set(booleanKeys);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (booleans.has(key)) {
      args[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

export function bangkokParts(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid --date: ${value}`);
}

export function validateTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`Invalid --time: ${value}`);
}

export function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function required(args, key) {
  if (!args[key] || !String(args[key]).trim()) throw new Error(`Missing required --${key}`);
  return String(args[key]).trim();
}

export function getEnabledProject(projectId) {
  const projects = loadProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Unknown project id: ${projectId}`);
  if (project.enabled === false) throw new Error(`Project is disabled: ${projectId}`);
  return project;
}

function mdInlineCodeList(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function entryBlock(entry) {
  return `## ${entry.time} - ${entry.repo}

- Repo: \`${entry.repo}\`
- Tags: ${mdInlineCodeList(entry.tags)}
- Summary: ${entry.summary}
- Verification: ${entry.verification}
- Commit: ${entry.commit}
- Push: ${entry.push}
- Next plan: ${entry.nextPlan}
- Blockers: ${entry.blockers}
`;
}

function tocRow(entry) {
  return `| ${entry.time} | \`${entry.repo}\` | ${mdInlineCodeList(entry.tags)} | ${entry.summary} |`;
}

function emptyDailyLog(date) {
  return `# ${date} Work Log

## Table Of Contents

| Time | Repo | Tags | Summary |
| --- | --- | --- | --- |

`;
}

export function upsertMarkdown(entry) {
  const logsDir = path.join(repoRoot, "logs", "daily");
  mkdirSync(logsDir, { recursive: true });
  const relativePath = path.join("logs", "daily", `${entry.date}.md`);
  const filePath = path.join(repoRoot, relativePath);
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : emptyDailyLog(entry.date);
  const nextRow = tocRow(entry);
  const lines = existing.split(/\r?\n/);

  const separatorIndex = lines.findIndex((line) => line.trim() === "| --- | --- | --- | --- |");
  if (separatorIndex === -1) {
    throw new Error(`Daily log is missing TOC separator row: ${relativePath}`);
  }

  const beforeRows = lines.slice(0, separatorIndex + 1);
  const afterSeparator = lines.slice(separatorIndex + 1);
  const existingRows = [];
  let bodyStartOffset = 0;

  for (const line of afterSeparator) {
    if (line.startsWith("| ")) {
      existingRows.push(line);
      bodyStartOffset += 1;
      continue;
    }
    break;
  }

  const rows = [nextRow, ...existingRows]
    .filter((row, index, allRows) => allRows.indexOf(row) === index)
    .sort((left, right) => {
      const leftTime = left.split("|")[1].trim();
      const rightTime = right.split("|")[1].trim();
      return rightTime.localeCompare(leftTime);
    });

  const body = afterSeparator.slice(bodyStartOffset).join("\n").trimStart();
  const nextBody = `${entryBlock(entry)}\n${body}`.trimEnd();
  const nextContent = `${[...beforeRows, ...rows].join("\n")}\n\n${nextBody}\n`;
  writeFileSync(filePath, nextContent);
  return relativePath;
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value ?? []))}::jsonb`;
}

function loggedAtIso(entry) {
  return `${entry.date}T${entry.time}:00+07:00`;
}

export function writeDb(entry, sourcePath) {
  const sql = `insert into log_entries (
  id,
  project_id,
  logged_at,
  log_date,
  log_time,
  repo,
  tags,
  summary,
  verification,
  commit_ref,
  push_status,
  next_plan,
  blockers,
  source_path,
  created_by
) values (
  ${sqlString(randomUUID())},
  ${sqlString(entry.projectId)},
  ${sqlString(loggedAtIso(entry))},
  ${sqlString(entry.date)},
  ${sqlString(entry.time)},
  ${sqlString(entry.repo)},
  ${sqlJson(entry.tags)},
  ${sqlString(entry.summary)},
  ${sqlString(entry.verification)},
  ${sqlString(entry.commit)},
  ${sqlString(entry.push)},
  ${sqlString(entry.nextPlan)},
  ${sqlString(entry.blockers)},
  ${sqlString(sourcePath)},
  ${sqlString("agent")}
);`;

  runSql(sql);
}

export function writeLogEntry(entry, options = {}) {
  const sourcePath = upsertMarkdown(entry);
  if (options.db) writeDb(entry, sourcePath);
  return sourcePath;
}
