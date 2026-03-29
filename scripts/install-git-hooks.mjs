import { execFileSync } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const hookPath = execFileSync("git", ["rev-parse", "--git-path", "hooks/pre-commit"], {
  encoding: "utf8",
}).trim();

const hookScript = `#!/bin/sh
pnpm exec lint-staged
`;

await mkdir(dirname(hookPath), { recursive: true });
await writeFile(hookPath, hookScript);
await chmod(hookPath, 0o755);
