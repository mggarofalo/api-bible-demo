//Sets up the pre-commit hook of this repository. `npm install` runs this script (the
//`prepare` script in package.json).
//
//The script writes a small file to .git/hooks/pre-commit that starts .githooks/pre-commit.
//Thus a change to .githooks/pre-commit applies immediately, and the other hooks in
//.git/hooks continue to operate. The script does not change `core.hooksPath`.
//
//The script never fails. Where there is no .git directory (a build server, a package
//archive), it does nothing.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "#api-bible-demo pre-commit";
const HOOK = `#!/bin/sh
${MARKER}
#This file starts the hook that the repository keeps in .githooks/pre-commit.
hook="$(git rev-parse --show-toplevel)/.githooks/pre-commit"
if [ -f "$hook" ]; then
  exec sh "$hook" "$@"
fi
`;

try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const gitDirectory = join(root, ".git");
  const target = join(gitDirectory, "hooks", "pre-commit");

  if (!existsSync(gitDirectory)) {
    //Not a clone of the repository
  } else if (existsSync(target) && !readFileSync(target, "utf8").includes(MARKER)) {
    console.warn(
      "A different pre-commit hook is in .git/hooks/pre-commit. It was not changed.\n" +
        "To use the hook of this repository, add this line to it: sh .githooks/pre-commit",
    );
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, HOOK, { mode: 0o755 });
  }
} catch (error) {
  console.warn(`The pre-commit hook was not set up: ${error.message}`);
}
