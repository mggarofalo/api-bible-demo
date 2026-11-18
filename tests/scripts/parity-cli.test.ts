import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

//Runs the static parity check as `npm run parity` does. It needs no network: the demo
//is in parity, so it must pass.
describe("scripts/parity.mjs", () => {
  it("passes the static checks with no failures", () => {
    const output = execFileSync(process.execPath, ["scripts/parity.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(output).toContain("1. Endpoints");
    expect(output).toContain("3. Source");
    expect(output).toContain("4. Reference and 5. Pages: not run.");
    expect(output).not.toContain("FAIL");
    expect(output).toMatch(/\n\d+ passed, 0 failed\n$/);
  });

  it("stops with an error when --wait is not a number", () => {
    const result = spawnSync(process.execPath, ["scripts/parity.mjs", "--live", "--wait=soon"], {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--wait must be a number");
    //It stops before the checks, and makes no request
    expect(result.stdout).toBe("");
  });
});
