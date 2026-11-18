import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

type Snapshot = {
  endpoints: Record<
    string,
    {
      methods: string[];
      summary?: string;
      description?: string;
      parameters: Record<string, { description?: string }>;
    }
  >;
};

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

  //The script finds its root from its own location, so a copy of the files that it reads
  //(the script, the manifest, the snapshot and the source of the demo) is a demo of its own.
  //Each test breaks one thing in a copy and runs the copy.
  describe("with a copy of the demo that has one problem", () => {
    const copies: string[] = [];
    afterEach(() => {
      for (const copy of copies.splice(0)) rmSync(copy, { recursive: true, force: true });
    });

    const makeCopy = () => {
      const copy = mkdtempSync(join(tmpdir(), "parity-cli-"));
      copies.push(copy);
      for (const directory of ["scripts", "parity", "app", "utils"]) {
        cpSync(join(root, directory), join(copy, directory), { recursive: true });
      }
      return copy;
    };
    const editJson = (file: string, change: (data: Snapshot) => void) => {
      const data = JSON.parse(readFileSync(file, "utf8"));
      change(data);
      writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    };
    const run = (copy: string) => {
      const result = spawnSync(process.execPath, [join(copy, "scripts", "parity.mjs")], {
        encoding: "utf8",
        timeout: 30000,
      });
      const lines = result.stdout.split("\n");
      return {
        status: result.status,
        output: result.stdout,
        failLines: lines.filter((line) => line.includes("FAIL")),
        failed: Number(/\n\d+ passed, (\d+) failed\n$/.exec(result.stdout)?.[1] ?? NaN),
      };
    };

    it("fails for an endpoint of the reference that the manifest does not have", () => {
      const copy = makeCopy();
      editJson(join(copy, "parity", "api-reference.json"), (reference) => {
        reference.endpoints["/new-endpoint"] = {
          methods: ["get"],
          summary: "New",
          description: "New endpoint",
          parameters: {},
        };
      });
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain("/new-endpoint is in the reference");
      expect(result.failed).toBeGreaterThanOrEqual(1);
    });

    it("fails for a query parameter of the reference that the manifest does not have", () => {
      const copy = makeCopy();
      editJson(join(copy, "parity", "api-reference.json"), (reference) => {
        reference.endpoints["/bibles/{bibleId}/books/{bookId}/chapters"].parameters["new-param"] = {
          description: "New parameter",
        };
      });
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain('the reference has the parameter "new-param"');
      expect(result.failed).toBeGreaterThanOrEqual(1);
    });

    it("fails for a page that does not call the SDK method", () => {
      const copy = makeCopy();
      const page = join(copy, "app", "bibles", "[bibleId]", "page.tsx");
      writeFileSync(page, readFileSync(page, "utf8").replace("client.bibles.get(", "client.bibles.other("));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain("the page does not call client.bibles.get()");
      expect(result.failed).toBeGreaterThanOrEqual(1);
    });

    it("fails for a page that does not have the name of a parameter", () => {
      const copy = makeCopy();
      const page = join(copy, "app", "bibles", "[bibleId]", "search", "page.tsx");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll('"fuzziness"', '"fuzzy"'));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain('the source does not contain the parameter "fuzziness"');
      expect(result.failed).toBeGreaterThanOrEqual(1);
    });

    it("stops with exit code 1 when the snapshot does not exist", () => {
      const copy = makeCopy();
      rmSync(join(copy, "parity", "api-reference.json"));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.output).toContain("parity/api-reference.json does not exist");
      //It stops before the checks
      expect(result.output).not.toContain("1. Endpoints");
    });
  });
});
