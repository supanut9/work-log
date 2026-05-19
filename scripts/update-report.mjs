import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./scan-repos.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const fetch = process.argv.includes("--fetch");
const capturedAt = new Date().toISOString();
const projects = collect({ fetch });

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

const enriched = projects.map((project) => ({ ...project, attention: attention(project) }));
const gitProjects = enriched.filter((project) => project.is_git_repo);
const needingAttention = enriched.filter((project) => project.attention);

const stats = {
  captured_at: capturedAt,
  fetch_performed: fetch,
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
  },
  projects: enriched,
};

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

function groupedNextPlans() {
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

const report = `# Supanut9 Work Log Current Report

Captured: ${capturedAt}

Fetch performed: ${fetch ? "yes" : "no"}

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

## Repos Needing Attention

${table(needingAttention)}

## Project Progress Sources

${groupedNextPlans()}

## All Projects

${table(enriched)}
`;

mkdirSync(path.join(repoRoot, "reports"), { recursive: true });
mkdirSync(path.join(repoRoot, "stats"), { recursive: true });
writeFileSync(path.join(repoRoot, "stats", "current.json"), `${JSON.stringify(stats, null, 2)}\n`);
writeFileSync(path.join(repoRoot, "reports", "current.md"), report);

process.stdout.write(`Wrote reports/current.md and stats/current.json for ${enriched.length} projects.\n`);

