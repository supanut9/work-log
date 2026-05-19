import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "config", "projects.yml");

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value === "[]") return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    const body = value.slice(1, -1).trim();
    return body ? body.split(",").map((item) => item.trim()) : [];
  }
  return value;
}

export function loadProjects() {
  const lines = readFileSync(configPath, "utf8").split(/\r?\n/);
  const projects = [];
  let current = null;
  let listKey = null;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#") || line.trim() === "projects:") continue;

    const itemMatch = line.match(/^  - ([^:]+):\s*(.*)$/);
    if (itemMatch) {
      current = {};
      projects.push(current);
      current[itemMatch[1]] = parseScalar(itemMatch[2]);
      listKey = null;
      continue;
    }

    const keyMatch = line.match(/^    ([^:]+):\s*(.*)$/);
    if (keyMatch && current) {
      const [, key, rawValue] = keyMatch;
      if (rawValue === "") {
        current[key] = [];
        listKey = key;
      } else {
        current[key] = parseScalar(rawValue);
        listKey = null;
      }
      continue;
    }

    const listMatch = line.match(/^      -\s*(.*)$/);
    if (listMatch && current && listKey) {
      current[listKey].push(parseScalar(listMatch[1]));
    }
  }

  return projects;
}

function runGit(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(cwd, args) {
  try {
    return { ok: true, output: runGit(cwd, args) };
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    return { ok: false, output: stderr || stdout || error.message };
  }
}

function isGitRepo(projectPath) {
  return tryGit(projectPath, ["rev-parse", "--is-inside-work-tree"]).output === "true";
}

function parseAheadBehind(projectPath, branch, hasOrigin) {
  if (!hasOrigin || !branch) return { ahead: null, behind: null };

  const upstream = `origin/${branch}`;
  const rev = tryGit(projectPath, ["rev-list", "--left-right", "--count", `${branch}...${upstream}`]);
  if (!rev.ok) return { ahead: null, behind: null };

  const [ahead, behind] = rev.output.split(/\s+/).map((value) => Number.parseInt(value, 10));
  return {
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null,
  };
}

function scanGitProject(project, projectPath, options) {
  const remote = tryGit(projectPath, ["remote", "get-url", "origin"]);
  const hasOrigin = remote.ok && remote.output.length > 0;
  let fetchStatus = hasOrigin ? "not_fetched" : "missing_origin";

  if (hasOrigin && options.fetch) {
    const fetch = tryGit(projectPath, ["fetch", "origin", "--prune"]);
    fetchStatus = fetch.ok ? "ok" : `failed: ${fetch.output}`;
  }

  const branchResult = tryGit(projectPath, ["branch", "--show-current"]);
  const branch = branchResult.ok ? branchResult.output || null : null;
  const dirtyResult = tryGit(projectPath, ["status", "--porcelain"]);
  const dirtyFiles = dirtyResult.ok && dirtyResult.output ? dirtyResult.output.split(/\r?\n/).length : 0;
  const lastHash = tryGit(projectPath, ["rev-parse", "--short", "HEAD"]);
  const lastSubject = tryGit(projectPath, ["log", "-1", "--pretty=%s"]);
  const { ahead, behind } = parseAheadBehind(projectPath, branch, hasOrigin);

  return {
    ...project,
    absolute_path: projectPath,
    exists: true,
    is_git_repo: true,
    branch,
    dirty_files: dirtyFiles,
    ahead,
    behind,
    has_origin: hasOrigin,
    fetch_status: fetchStatus,
    last_commit_hash: lastHash.ok ? lastHash.output : null,
    last_commit_subject: lastSubject.ok ? lastSubject.output : null,
    remote_url: hasOrigin ? remote.output : null,
  };
}

function scanNonGitProject(project, projectPath) {
  return {
    ...project,
    absolute_path: projectPath,
    exists: existsSync(projectPath),
    is_git_repo: false,
    branch: null,
    dirty_files: 0,
    ahead: null,
    behind: null,
    has_origin: false,
    fetch_status: "not_git",
    last_commit_hash: null,
    last_commit_subject: null,
    remote_url: null,
  };
}

export function collect(options = {}) {
  const projects = loadProjects().filter((project) => project.enabled !== false);
  return projects.map((project) => {
    const projectPath = path.resolve(repoRoot, project.path);
    if (!existsSync(projectPath)) {
      return { ...scanNonGitProject(project, projectPath), fetch_status: "missing_path" };
    }

    if (isGitRepo(projectPath)) return scanGitProject(project, projectPath, options);
    return scanNonGitProject(project, projectPath);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fetch = process.argv.includes("--fetch");
  const snapshots = collect({ fetch });
  process.stdout.write(`${JSON.stringify({ captured_at: new Date().toISOString(), projects: snapshots }, null, 2)}\n`);
}

