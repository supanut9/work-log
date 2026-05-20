import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export function runSql(sql) {
  return execFileSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "psql", "-U", "work_log", "-d", "work_log", "-v", "ON_ERROR_STOP=1"],
    {
      cwd: repoRoot,
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const relativeFile = process.argv[2];
  if (!relativeFile) {
    process.stderr.write("Usage: node scripts/db-psql.mjs <sql-file>\n");
    process.exit(1);
  }

  const sqlFile = path.resolve(repoRoot, relativeFile);
  const sql = readFileSync(sqlFile, "utf8");
  process.stdout.write(runSql(sql));
}
