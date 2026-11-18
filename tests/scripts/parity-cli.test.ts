import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { coverage } from "@/parity/coverage.mjs";
import { coveredEntries, pageRequest } from "@/scripts/parity-lib.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

type Parameter = { values?: string[]; default?: string; description?: string };
type Endpoint = {
  methods: string[];
  summary?: string;
  description?: string;
  parameters: Record<string, Parameter>;
  pathParameters?: Record<string, string>;
};
type Snapshot = { source: string; version: string; endpoints: Record<string, Endpoint> };
type Manifest = Parameters<typeof pageRequest>[1];

const covered = coveredEntries(coverage) as [string, Manifest][];

//The result of a run of the script
const parse = (stdout: string, stderr: string, status: number | null) => {
  const lines = stdout.split("\n");
  const summary = /\n(\d+) passed, (\d+) failed\n$/.exec(stdout);
  /** The lines of a section, such as "5." */
  const section = (number: string) => {
    const start = lines.findIndex((line) => line.startsWith(`${number} `));
    if (start === -1) return [];
    const end = lines.indexOf("", start);
    return lines.slice(start + 1, end === -1 ? undefined : end);
  };
  return {
    status,
    output: stdout,
    stderr,
    okLines: lines.filter((line) => line.startsWith("  ok    ")),
    failLines: lines.filter((line) => line.includes("FAIL")),
    passed: Number(summary?.[1] ?? NaN),
    failed: Number(summary?.[2] ?? NaN),
    section,
  };
};

//The script finds its root from its own location, so a copy of the files that it reads
//(the script, the manifest, the snapshot and the source of the demo) is a demo of its own.
const copies: string[] = [];
const makeCopy = () => {
  const copy = mkdtempSync(join(tmpdir(), "parity-cli-"));
  copies.push(copy);
  for (const directory of ["scripts", "parity", "app", "utils"]) {
    cpSync(join(root, directory), join(copy, directory), { recursive: true });
  }
  return copy;
};
const snapshotFile = (copy: string) => join(copy, "parity", "api-reference.json");
const readSnapshot = (copy: string): Snapshot => JSON.parse(readFileSync(snapshotFile(copy), "utf8"));
const editJson = (file: string, change: (data: Snapshot) => void) => {
  const data = JSON.parse(readFileSync(file, "utf8"));
  change(data);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

//Runs the static parity check as `npm run parity` does. It needs no network: the demo
//is in parity, so it must pass.
describe("scripts/parity.mjs", () => {
  afterEach(() => {
    for (const copy of copies.splice(0)) rmSync(copy, { recursive: true, force: true });
  });

  it("passes the static checks with no failures", () => {
    const output = execFileSync(process.execPath, ["scripts/parity.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = parse(output, "", 0);
    expect(output).toContain("1. Endpoints");
    expect(output).toContain("3. Source");
    expect(output).toContain("4. Reference and 5. Pages: not run.");
    expect(output).not.toContain("FAIL");
    expect(result.failed).toBe(0);
    //The count is the number of checks that passed
    expect(result.passed).toBeGreaterThan(0);
    expect(result.passed).toBe(result.okLines.length);
  });

  it.each([[["--wait=soon"]], [["--live", "--wait=soon"]], [["--reference-url=swagger.json"]]])(
    "stops with an error for the options %j",
    (args) => {
      const result = spawnSync(process.execPath, ["scripts/parity.mjs", ...args], {
        cwd: root,
        encoding: "utf8",
        timeout: 20000,
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/--(wait|reference-url) must be/);
      //It stops before the checks, and makes no request
      expect(result.stdout).toBe("");
    },
  );

  //Each test breaks one thing in a copy and runs the copy
  describe("with a copy of the demo that has one problem", () => {
    const run = (copy: string) => {
      const result = spawnSync(process.execPath, [join(copy, "scripts", "parity.mjs")], {
        encoding: "utf8",
        timeout: 30000,
      });
      return parse(result.stdout, result.stderr, result.status);
    };
    //Each failure has one FAIL line, and the count is the number of FAIL lines
    const expectCounted = (result: ReturnType<typeof run>) => {
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBe(result.failLines.length);
      expect(result.passed).toBe(result.okLines.length);
    };

    it("fails for an endpoint of the reference that the manifest does not have", () => {
      const copy = makeCopy();
      editJson(snapshotFile(copy), (reference) => {
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
      expectCounted(result);
    });

    it("fails for a query parameter of the reference that the manifest does not have", () => {
      const copy = makeCopy();
      editJson(snapshotFile(copy), (reference) => {
        reference.endpoints["/bibles/{bibleId}/books/{bookId}/chapters"].parameters["new-param"] = {
          description: "New parameter",
        };
      });
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain('the reference has the parameter "new-param"');
      expectCounted(result);
    });

    it("fails for a page that does not call the SDK method", () => {
      const copy = makeCopy();
      const page = join(copy, "app", "bibles", "[bibleId]", "page.tsx");
      writeFileSync(page, readFileSync(page, "utf8").replace("client.bibles.get(", "client.bibles.other("));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain("the page does not call client.bibles.get()");
      expectCounted(result);
    });

    it("fails for a page that does not have the name of a parameter", () => {
      const copy = makeCopy();
      const page = join(copy, "app", "bibles", "[bibleId]", "search", "page.tsx");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll('"fuzziness"', '"fuzzy"'));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines.join(" | ")).toContain('the source does not contain the parameter "fuzziness"');
      expectCounted(result);
    });

    it("fails for a covered endpoint that has no page file", () => {
      const copy = makeCopy();
      rmSync(join(copy, "app", "bibles", "[bibleId]", "books", "[bookId]", "page.tsx"));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines).toEqual([
        "  FAIL  /bibles/{bibleId}/books/{bookId}: the demo has no page at app/bibles/[bibleId]/books/[bookId]/page.tsx",
      ]);
      expectCounted(result);
    });

    it("fails for a parameter of the manifest that has no sample and is not deferred", () => {
      const copy = makeCopy();
      const manifest = join(copy, "parity", "coverage.mjs");
      const source = readFileSync(manifest, "utf8");
      expect(source).toContain('fuzziness: { sample: "1" }');
      writeFileSync(manifest, source.replace('fuzziness: { sample: "1" }', "fuzziness: {}"));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.failLines).toEqual([
        '  FAIL  /bibles/{bibleId}/search: the parameter "fuzziness" has no sample',
      ]);
      expectCounted(result);
    });

    it("stops with exit code 1 when the snapshot does not exist", () => {
      const copy = makeCopy();
      rmSync(snapshotFile(copy));
      const result = run(copy);
      expect(result.status).toBe(1);
      expect(result.output).toContain("parity/api-reference.json does not exist");
      //It stops before the checks
      expect(result.output).not.toContain("1. Endpoints");
    });
  });

  //The live checks and the update get the reference and the pages from a server in the
  //test, so they need no network. The script runs as a child process with `spawn`, not
  //`spawnSync`: the server runs in the event loop of the test, which must not be blocked.
  describe("--live and --update with a fake reference and a fake demo", () => {
    const servers: Server[] = [];
    const children: ChildProcess[] = [];
    afterEach(async () => {
      for (const child of children.splice(0)) child.kill();
      await Promise.all(
        servers.splice(0).map(
          (server) =>
            new Promise((resolve) => {
              server.closeAllConnections();
              server.close(resolve);
            }),
        ),
      );
    });

    //A swagger document that `normalizeReference` turns into the snapshot again
    const swaggerFrom = (snapshot: Snapshot) => ({
      info: { version: snapshot.version },
      paths: Object.fromEntries(
        Object.entries(snapshot.endpoints).map(([path, endpoint]) => {
          const operation = {
            summary: endpoint.summary,
            description: endpoint.description,
            parameters: [
              ...Object.entries(endpoint.pathParameters ?? {}).map(([name, description]) => ({
                name,
                in: "path",
                required: true,
                description,
              })),
              ...Object.entries(endpoint.parameters).map(([name, parameter]) => ({
                name,
                in: "query",
                description: parameter.description,
                schema: {
                  type: "string",
                  ...(parameter.values ? { enum: parameter.values } : {}),
                  ...(parameter.default === undefined ? {} : { default: parameter.default }),
                },
              })),
            ],
          };
          return [path, Object.fromEntries(endpoint.methods.map((method) => [method, operation]))];
        }),
      ),
    });

    const escapeHtml = (text: string) =>
      text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    //Shows Markdown as a page does: links, code and bold text become elements
    const renderMarkdown = (text = "") =>
      escapeHtml(text)
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    //The HTML of a demo page that is in parity: the API request with the expected value of
    //each parameter (and no default), the status 200 and the text of the reference
    const pageHtml = (snapshot: Snapshot, path: string, entry: Manifest, request?: string) => {
      const { params, route } = pageRequest(path, entry);
      const endpoint = snapshot.endpoints[path];
      const query = new URLSearchParams(
        params.flatMap(({ name, sample, expect: value = sample }) =>
          value === undefined || endpoint.parameters[name]?.default === value ? [] : [[name, value]],
        ),
      ).toString();
      const url = request ?? `https://rest.api.bible/v1${route}${query ? `?${query}` : ""}`;
      return [
        "<!DOCTYPE html><html><body>",
        `<h1>${renderMarkdown(endpoint.summary)}</h1>`,
        ...(endpoint.description ?? "").split(/\n\s*\n/).map((paragraph) => `<p>${renderMarkdown(paragraph)}</p>`),
        ...params.map(({ name }) => `<label>${name}<small>${renderMarkdown(endpoint.parameters[name]?.description)}</small></label>`),
        `<pre data-api-request="${escapeHtml(url)}" data-api-status="200">{}</pre>`,
        "</body></html>",
      ].join("\n");
    };

    //The ports above 1023 that `fetch` refuses (https://fetch.spec.whatwg.org/#bad-port)
    const BAD_PORTS = new Set([
      1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
      6669, 6679, 6697, 10080,
    ]);

    type Reply = { status: number; body: string; type?: string } | "drop";
    //A server on a free port. `reply` answers each request by its path and query.
    const startServer = async (reply: (url: URL) => Reply) => {
      const server = createServer((request, response) => {
        const answer = reply(new URL(request.url ?? "/", "http://127.0.0.1"));
        if (answer === "drop") {
          request.socket.destroy();
          return;
        }
        response.writeHead(answer.status, { "content-type": answer.type ?? "text/html" });
        response.end(answer.body);
      });
      servers.push(server);
      //`fetch` refuses some ports (the "bad ports" of the Fetch standard), and Windows can
      //give a free port in that list. Listen again until the port is one that `fetch` uses.
      for (;;) {
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        const { port } = server.address() as AddressInfo;
        if (!BAD_PORTS.has(port)) return `http://127.0.0.1:${port}`;
        await new Promise((resolve) => server.close(resolve));
      }
    };

    type Changes = {
      //Changes the published reference, which is the snapshot by default
      published?: (reference: Snapshot) => void;
      reference?: (url: URL) => Reply | undefined;
      page?: (path: string, html: string) => Reply | undefined;
      demo?: (url: URL) => Reply | undefined;
    };
    //A server with the published reference at /swagger.json and a page for each covered endpoint
    const startFake = (snapshot: Snapshot, changes: Changes = {}) => {
      const published: Snapshot = structuredClone(snapshot);
      changes.published?.(published);
      const swagger = JSON.stringify(swaggerFrom(published));
      const pages = new Map(
        covered.map(([path, entry]) => {
          const url = new URL(pageRequest(path, entry).pagePath, "http://127.0.0.1");
          return [url.pathname + url.search, [path, pageHtml(snapshot, path, entry)] as const];
        }),
      );
      return startServer((url) => {
        if (url.pathname === "/swagger.json") {
          return changes.reference?.(url) ?? { status: 200, body: swagger, type: "application/json" };
        }
        const demo = changes.demo?.(url);
        if (demo) return demo;
        if (url.pathname === "/") return { status: 200, body: "<html>Demo</html>" };
        const page = pages.get(url.pathname + url.search);
        if (!page) return { status: 404, body: "Not found" };
        const [path, html] = page;
        return changes.page?.(path, html) ?? { status: 200, body: html };
      });
    };

    //Runs the copy without blocking the event loop. It kills a run that hangs.
    const runAsync = (copy: string, args: string[], timeout = 20000) =>
      new Promise<ReturnType<typeof parse> & { seconds: number }>((resolve) => {
        const start = Date.now();
        const child = spawn(process.execPath, [join(copy, "scripts", "parity.mjs"), ...args]);
        children.push(child);
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", (data) => (stdout += data));
        child.stderr.setEncoding("utf8").on("data", (data) => (stderr += data));
        const timer = setTimeout(() => child.kill(), timeout);
        child.on("close", (status) => {
          clearTimeout(timer);
          resolve({ ...parse(stdout, stderr, status), seconds: (Date.now() - start) / 1000 });
        });
      });
    const live = (copy: string, baseUrl: string, referenceUrl = `${baseUrl}/swagger.json`, wait = "0") =>
      runAsync(copy, ["--live", `--base-url=${baseUrl}`, `--reference-url=${referenceUrl}`, `--wait=${wait}`]);

    //The number of checks that pass without --live
    const staticPasses = (copy: string) =>
      parse(spawnSync(process.execPath, [join(copy, "scripts", "parity.mjs")], { encoding: "utf8" }).stdout, "", 0)
        .passed;

    it("passes when the reference, the snapshot and the pages agree", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const snapshot = readSnapshot(copy);
      const url = await startFake(snapshot);
      const result = await live(copy, url);
      expect(result.failLines).toEqual([]);
      expect(result.status).toBe(0);
      expect(result.section("4.")).toEqual([
        `  ok    ${Object.keys(snapshot.endpoints).length} endpoints, no differences`,
      ]);
      expect(result.output).toContain(`4. Reference: the published reference is the same as the snapshot (${url}/swagger.json)`);
      //Each covered page passed with the request that the manifest describes
      const pages = result.section("5.");
      expect(pages).toHaveLength(covered.length);
      for (const [index, [path]] of covered.entries()) {
        expect(pages[index]).toMatch(new RegExp(`^  ok    ${path.replace(/[{}]/g, "\\$&")} → /v1/`));
      }
      expect(result.failed).toBe(0);
      expect(result.passed).toBe(result.okLines.length);
      expect(result.passed).toBe(staticPasses(copy) + 1 + covered.length);
    });

    it("fails when the published reference is different from the snapshot", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const snapshot = readSnapshot(copy);
      const url = await startFake(snapshot, {
        published: (reference) => {
          reference.endpoints["/bibles"].parameters["new-param"] = { description: "New" };
          reference.endpoints["/bibles/{bibleId}/books"].parameters["include-chapters"].default = "true";
        },
      });
      const result = await live(copy, url);
      expect(result.status).toBe(1);
      expect(result.section("4.")).toEqual([
        '  FAIL  /bibles has the new parameter "new-param"',
        '  FAIL  /bibles/{bibleId}/books: the default of "include-chapters" changed to "true"',
        '        Run "npm run parity:update", then "npm run parity".',
      ]);
      //The pages agree with the snapshot, so they pass
      expect(result.failLines).toHaveLength(2);
      expect(result.failed).toBe(2);
    });

    it("fails when the reference cannot be loaded, and checks the pages", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const url = await startFake(readSnapshot(copy), {
        reference: () => ({ status: 500, body: '{"error":"down"}', type: "application/json" }),
      });
      const result = await live(copy, url);
      expect(result.status).toBe(1);
      expect(result.failLines).toEqual([
        `  FAIL  cannot get the published reference (${url}/swagger.json gave the status 500)`,
      ]);
      expect(result.failed).toBe(1);
      expect(result.section("5.")).toHaveLength(covered.length);
    });

    it("fails only for the pages that fail", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const url = await startFake(readSnapshot(copy), {
        page: (path, html) => {
          if (path === "/bibles/{bibleId}") return { status: 500, body: html };
          if (path === "/bibles/{bibleId}/books") {
            //The request has another Bible in the path, and the same query
            const body = html.replace(/(data-api-request="https:\/\/rest\.api\.bible\/v1\/bibles\/)[^/]+/, "$1other");
            expect(body).not.toBe(html);
            return { status: 200, body };
          }
          return undefined;
        },
      });
      const bible = covered.find(([path]) => path === "/bibles/{bibleId}")!;
      const books = covered.find(([path]) => path === "/bibles/{bibleId}/books")!;
      const result = await live(copy, url);
      expect(result.status).toBe(1);
      expect(result.failLines).toEqual([
        `  FAIL  /bibles/{bibleId}: ${pageRequest(...bible).pagePath} gave the status 500`,
        `  FAIL  /bibles/{bibleId}/books: the API path is /v1/bibles/other/books, not /v1${pageRequest(...books).route}`,
      ]);
      expect(result.failed).toBe(2);
      expect(result.section("5.")).toHaveLength(covered.length);
    });

    it("fails promptly when the demo is not running", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const referenceUrl = `${await startFake(readSnapshot(copy))}/swagger.json`;
      //A port that was free a moment ago, where no server listens
      const closed = await startServer(() => ({ status: 200, body: "" }));
      const server = servers.pop()!;
      await new Promise((resolve) => server.close(resolve));
      const result = await runAsync(
        copy,
        ["--live", `--base-url=${closed}`, `--reference-url=${referenceUrl}`, "--wait=0"],
        10000,
      );
      expect(result.status).toBe(1);
      expect(result.seconds).toBeLessThan(8);
      expect(result.failLines).toEqual([
        `  FAIL  cannot connect to the demo at ${closed}. Start it with "npm run dev" or "npm run start".`,
      ]);
      expect(result.failed).toBe(1);
    });

    it("waits for a demo that starts within --wait", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      let dropped = 0;
      let ready = Infinity;
      const url = await startFake(readSnapshot(copy), {
        //The demo does not answer during the first second
        demo: () => (Date.now() < ready ? (dropped++, "drop") : undefined),
      });
      ready = Date.now() + 1000;
      const result = await live(copy, url, undefined, "2");
      //It tried while the demo was not up, and then checked the pages
      expect(dropped).toBeGreaterThanOrEqual(1);
      expect(result.failLines).toEqual([]);
      expect(result.status).toBe(0);
      expect(result.section("5.")).toHaveLength(covered.length);
    });

    it("writes the snapshot again from the published reference", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const snapshot = readSnapshot(copy);
      const url = await startFake(snapshot);
      //The snapshot in the copy is old: the published reference has the text and the default
      editJson(snapshotFile(copy), (reference) => {
        delete reference.endpoints["/bibles"].summary;
        reference.endpoints["/bibles/{bibleId}/books"].parameters["include-chapters"].default = "true";
        delete reference.endpoints["/bibles/{bibleId}/search"];
      });
      const result = await runAsync(copy, ["--update", `--reference-url=${url}/swagger.json`]);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.output).toContain(
        `Wrote parity/api-reference.json from ${url}/swagger.json (version ${snapshot.version}, ${Object.keys(snapshot.endpoints).length} endpoints).`,
      );
      //The new snapshot is the published reference, with its address as the source
      expect(readFileSync(snapshotFile(copy), "utf8")).toBe(
        JSON.stringify({ ...snapshot, source: `${url}/swagger.json` }, null, 2) + "\n",
      );
      //It does not run the checks
      expect(result.output).not.toContain("1. Endpoints");
    });

    it("does not change the snapshot when the reference cannot be loaded", { timeout: 30000 }, async () => {
      const copy = makeCopy();
      const url = await startFake(readSnapshot(copy), {
        reference: () => ({ status: 500, body: "Server error" }),
      });
      const before = readFileSync(snapshotFile(copy), "utf8");
      const result = await runAsync(copy, ["--update", `--reference-url=${url}/swagger.json`]);
      expect(result.status).toBe(1);
      //A message, not a stack trace of an uncaught error
      expect(result.stderr).toBe(`cannot get the published reference (${url}/swagger.json gave the status 500)\n`);
      expect(result.output).toBe("");
      expect(existsSync(snapshotFile(copy))).toBe(true);
      expect(readFileSync(snapshotFile(copy), "utf8")).toBe(before);
    });
  });
});
