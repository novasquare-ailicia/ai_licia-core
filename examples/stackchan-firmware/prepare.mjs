import {cpSync, existsSync, mkdirSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const upstream = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
const target = resolve(process.argv[2] ?? join(root, "build", "StackChan"));

const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, {cwd, stdio: "inherit"});
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!existsSync(join(target, ".git"))) {
  mkdirSync(dirname(target), {recursive: true});
  run("git", ["clone", upstream.repository, target]);
} else {
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: target,
    encoding: "utf8",
  });
  if (status.status !== 0 || status.stdout.trim().length > 0) {
    console.error(`Refusing to modify a non-clean checkout: ${target}`);
    console.error("Choose a new target directory or clean that checkout first.");
    process.exit(1);
  }
}

const hasPinnedCommit = spawnSync(
  "git",
  ["cat-file", "-e", `${upstream.commit}^{commit}`],
  {cwd: target, stdio: "ignore"},
).status === 0;
if (!hasPinnedCommit) run("git", ["fetch", "origin", upstream.commit], target);
run("git", ["checkout", "--detach", upstream.commit], target);

cpSync(join(root, "overlay"), target, {recursive: true, force: true});
run("git", ["apply", "--check", join(root, "patches", "stackchan-ai-licia.patch")], target);
run("git", ["apply", join(root, "patches", "stackchan-ai-licia.patch")], target);

console.log(`\nPrepared ai_licia StackChan firmware at ${target}`);
console.log(`Next: cd ${join(target, "firmware")}`);
console.log("      python3 fetch_repos.py");
console.log("      idf.py build");
console.log("      idf.py flash monitor");

