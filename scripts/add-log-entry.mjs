import {
  bangkokParts,
  getEnabledProject,
  parseArgs,
  required,
  splitTags,
  validateDate,
  validateTime,
  writeLogEntry,
} from "./log-entry-lib.mjs";

function usage() {
  return `Usage:
  npm run log:add -- --project <id> --tags <a,b> --summary <text> --verification <text> --commit <text> --push <text> --next-plan <text> --blockers <text> [--date YYYY-MM-DD] [--time HH:mm] [--repo <label>] [--db]
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2), ["db"]);
  const now = bangkokParts();
  const date = args.date || now.date;
  const time = args.time || now.time;
  validateDate(date);
  validateTime(time);

  const projectId = required(args, "project");
  getEnabledProject(projectId);

  const entry = {
    projectId,
    repo: args.repo || projectId,
    date,
    time,
    tags: splitTags(required(args, "tags")),
    summary: required(args, "summary"),
    verification: required(args, "verification"),
    commit: required(args, "commit"),
    push: required(args, "push"),
    nextPlan: required(args, "next-plan"),
    blockers: required(args, "blockers"),
  };

  const sourcePath = writeLogEntry(entry, { db: args.db });
  process.stdout.write(`${args.db ? "Wrote markdown and DB log entry" : "Wrote markdown log entry"}: ${sourcePath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage()}`);
  process.exit(1);
}
