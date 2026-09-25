import { execFileSync } from "node:child_process";

const npmExecPath = process.env.npm_execpath;

if (!npmExecPath) {
  throw new Error("npm_execpath is unavailable; run this check through npm.");
}

const output = execFileSync(
  process.execPath,
  [npmExecPath, "install-scripts", "ls", "--json"],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
);

const report = JSON.parse(output);
const pendingScripts = report.allowScripts ?? [];

if (pendingScripts.length > 0) {
  console.error(
    "Dependency install scripts require review before trusted rebuilds run:",
  );
  console.error(JSON.stringify(pendingScripts, null, 2));
  process.exit(1);
}

console.log("Dependency install-script approvals are current.");
