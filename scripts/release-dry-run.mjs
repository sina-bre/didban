// `pnpm release:dry-run` (Stage 6d, ADR 0052), after `pnpm build`: everything a release does except
// the upload. 1) publish plan against the registry (read-only), 2) `changeset version` with a sample
// changeset in a throwaway git worktree (this checkout is never touched), 3) `pnpm publish --dry-run`
// and the tarball file list of each public package. Never publishes, tags or pushes.
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PACKAGES = ["packages/sdk", "packages/react"];
const changeset = resolve("node_modules/.bin/changeset");
// Every part is a constant or a path this script made (npm/pnpm are .cmd shims on Windows).
const run = (line, cwd = ".") => {
  console.log(`\n$ ${line}   (${cwd})`);
  const out = execSync(line, { cwd, encoding: "utf8", stdio: "pipe" });
  console.log(out.trim());
  return out;
};

run(`"${changeset}" publish-plan`);

const work = join(mkdtempSync(join(tmpdir(), "didban-release-")), "tree");
run(`git worktree add --detach "${work}" HEAD`);
try {
  writeFileSync(
    join(work, ".changeset", "dry-run-sample.md"),
    '---\n"@didban/analytics": minor\n---\n\nSample entry written by the release dry run.\n',
  );
  run(`"${changeset}" version`, work);
  run("git status --short", work);
  for (const dir of PACKAGES) {
    const manifest = JSON.parse(readFileSync(join(work, dir, "package.json"), "utf8"));
    console.log(`${manifest.name} → ${manifest.version}`, manifest.peerDependencies ?? "");
    console.log(readFileSync(join(work, dir, "CHANGELOG.md"), "utf8").trim());
  }
} finally {
  run(`git worktree remove --force "${work}"`);
  rmSync(resolve(work, ".."), { recursive: true, force: true });
}

for (const dir of PACKAGES) {
  run("pnpm publish --dry-run --no-git-checks", dir);
  run("pnpm pack --dry-run", dir);
}
console.log("\nrelease dry run: ok (nothing published, tagged or pushed)");
