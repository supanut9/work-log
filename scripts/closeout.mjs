import { collect } from "./scan-repos.mjs";
import {
  bangkokParts,
  parseArgs,
  required,
  splitTags,
  validateDate,
  validateTime,
  writeLogEntry,
} from "./log-entry-lib.mjs";

function usage() {
  return `Usage:
  npm run closeout -- --project <id> --verification <text> --next-plan <text> [--summary <text>] [--tags <a,b>] [--blockers <text>] [--date YYYY-MM-DD] [--time HH:mm] [--repo <label>] [--fetch] [--db]
`;
}

function formatCommit(snapshot) {
  if (!snapshot.is_git_repo) return "not a git repository";
  if (!snapshot.last_commit_hash || !snapshot.last_commit_subject) return "no commit found";
  return `${snapshot.last_commit_hash} ${snapshot.last_commit_subject}`;
}

function formatPush(snapshot) {
  if (!snapshot.is_git_repo) return "not applicable";
  if (!snapshot.has_origin) return "missing origin";
  if (snapshot.fetch_status.startsWith("failed:")) return snapshot.fetch_status;
  if (snapshot.ahead > 0 && snapshot.behind > 0) return `divergent: ${snapshot.ahead} ahead, ${snapshot.behind} behind`;
  if (snapshot.ahead > 0) return `not pushed: ${snapshot.ahead} commit${snapshot.ahead === 1 ? "" : "s"} ahead of origin`;
  if (snapshot.behind > 0) return `behind origin by ${snapshot.behind} commit${snapshot.behind === 1 ? "" : "s"}`;
  return "pushed/synced with origin";
}

function defaultSummary(snapshot) {
  const parts = [];
  if (snapshot.branch) parts.push(`on ${snapshot.branch}`);
  if (snapshot.dirty_files > 0) parts.push(`${snapshot.dirty_files} dirty file${snapshot.dirty_files === 1 ? "" : "s"}`);
  if (snapshot.ahead > 0) parts.push(`${snapshot.ahead} commit${snapshot.ahead === 1 ? "" : "s"} ahead`);
  if (!snapshot.has_origin && snapshot.is_git_repo) parts.push("missing origin");

  return `Closed out ${snapshot.id} work${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

function defaultTags(snapshot) {
  const tags = ["closeout", ...(snapshot.tags || [])];
  return [...new Set(tags)].slice(0, 6);
}

function formatBlockers(snapshot, blockers) {
  const notes = [];
  const base = blockers || "none";
  if (base.toLowerCase() !== "none") notes.push(base);
  if (snapshot.dirty_files > 0) notes.push(`dirty files at closeout: ${snapshot.dirty_files}`);
  if (!snapshot.has_origin && snapshot.is_git_repo) notes.push("missing origin");
  if (snapshot.fetch_status.startsWith("failed:")) notes.push(snapshot.fetch_status);
  return notes.length ? notes.join("; ") : "none";
}

function main() {
  const args = parseArgs(process.argv.slice(2), ["db", "fetch"]);
  const now = bangkokParts();
  const date = args.date || now.date;
  const time = args.time || now.time;
  validateDate(date);
  validateTime(time);

  const projectId = required(args, "project");
  const snapshots = collect({ fetch: args.fetch });
  const snapshot = snapshots.find((item) => item.id === projectId);
  if (!snapshot) throw new Error(`Unknown or disabled project id: ${projectId}`);

  const entry = {
    projectId,
    repo: args.repo || projectId,
    date,
    time,
    tags: args.tags ? splitTags(args.tags) : defaultTags(snapshot),
    summary: args.summary || defaultSummary(snapshot),
    verification: required(args, "verification"),
    commit: args.commit || formatCommit(snapshot),
    push: args.push || formatPush(snapshot),
    nextPlan: required(args, "next-plan"),
    blockers: formatBlockers(snapshot, args.blockers),
  };

  const sourcePath = writeLogEntry(entry, { db: args.db });
  process.stdout.write(`${args.db ? "Wrote markdown and DB closeout" : "Wrote markdown closeout"}: ${sourcePath}\n`);
  process.stdout.write(`Project: ${projectId}\n`);
  process.stdout.write(`Commit: ${entry.commit}\n`);
  process.stdout.write(`Push: ${entry.push}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage()}`);
  process.exit(1);
}
