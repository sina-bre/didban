// Lists tracked + untracked (not ignored) files, so checks see new files before the first commit.
import { execFileSync } from "node:child_process";

export function listFiles() {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}
