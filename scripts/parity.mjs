#!/usr/bin/env node
/**
 * Parity check: makes sure that this demo shows all of the API.Bible API.
 *
 * The authority is the API reference that API.Bible publishes: an OpenAPI document at
 * https://rest.api.bible/v1/swagger.json. `parity/api-reference.json` is a snapshot of
 * its endpoints and query parameters, and `parity/coverage.mjs` says how the demo
 * shows each of them.
 *
 *   npm run parity          Static checks. No server, network or API key is necessary.
 *   npm run parity:live     Static checks, then live checks against the published
 *                           reference and a running demo.
 *   npm run parity:update   Gets the published reference and writes the snapshot again.
 *
 * Static checks (fast, run on every change):
 *   1. Endpoints   Each endpoint of the reference is in the manifest, and each entry of
 *                  the manifest is an endpoint of the reference.
 *   2. Parameters  Each query parameter of each covered endpoint is in the manifest, and
 *                  the manifest has no parameter that the reference does not have. The
 *                  reference has a summary and a description for each endpoint, and a
 *                  description for each parameter, because the demo shows them as help text.
 *   3. Source      For each covered endpoint, the demo has a page at the same path, and
 *                  the page calls the API. The source also contains the name of each
 *                  covered parameter, and each value of a parameter with fixed values.
 *
 * Live checks (run on a schedule):
 *   4. Reference   The published reference is the same as the snapshot. A difference
 *                  means that the API changed. Run "npm run parity:update", then do the
 *                  static checks again to see what the demo must add.
 *   5. Pages       Each covered page loads, with every parameter set to its sample
 *                  value. The API request that the page made must have:
 *                    - the status 200
 *                    - the same path as the page (the paths of the demo agree with the API)
 *                    - each parameter of the manifest, with the expected value. A value
 *                      that is the default of the API must be absent: the demo does
 *                      not send defaults.
 *                    - no parameter that the manifest does not have
 *                  A page whose response has a FUMS token must load the FUMS script.
 *                  The page must also show the text of the reference: the summary and
 *                  the description of the endpoint, and the description of each parameter.
 *
 * Options:
 *   --live               Also run the live checks.
 *   --update             Write the snapshot again from the published reference, then stop.
 *   --base-url=<url>     Address of the running demo. Default: http://localhost:3000
 *   --wait=<seconds>     Wait up to this time for the demo to start. Default: 0
 *
 * The exit code is 1 if a check fails, and 0 if all checks pass.
 *
 * This file does the file and network I/O and prints the results. The checks themselves
 * are in `scripts/parity-lib.mjs`, so that the tests can call them.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { coverage } from "../parity/coverage.mjs";
import {
  checkEndpoints,
  checkPageHtml,
  checkParameters,
  checkSource,
  coveredEntries,
  normalizeReference,
  pageRequest,
  parseOptions,
  referenceDifferences,
} from "./parity-lib.mjs";

const REFERENCE_URL = "https://rest.api.bible/v1/swagger.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(root, "parity", "api-reference.json");

const options = (() => {
  try {
    return parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
})();
const { live, update, baseUrl, waitSeconds } = options;

let failures = 0;
let passes = 0;
const pass = (message) => {
  passes++;
  console.log(`  ok    ${message}`);
};
const fail = (message) => {
  failures++;
  console.log(`  FAIL  ${message}`);
};
const section = (title) => console.log(`\n${title}`);
/** Prints the results of a check */
const report = (results) => {
  for (const { ok, message } of results) (ok ? pass : fail)(message);
};

/* ---------- The API reference ---------- */

/**
 * Gets the published API reference and keeps only the data that the parity check
 * uses (see `normalizeReference`). The demo reads the defaults and the help text from
 * the snapshot (utils/apiReference.ts), so it shows the words of the reference.
 */
const fetchReference = async () => {
  const response = await fetch(REFERENCE_URL, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`${REFERENCE_URL} gave the status ${response.status}`);
  }
  return normalizeReference(await response.json(), REFERENCE_URL);
};

/** Writes the snapshot again from the published reference */
const runUpdate = async () => {
  const published = await fetchReference();
  writeFileSync(snapshotPath, JSON.stringify(published, null, 2) + "\n");
  console.log(
    `Wrote parity/api-reference.json from ${REFERENCE_URL} (version ${published.version}, ${Object.keys(published.endpoints).length} endpoints).`,
  );
  console.log('Run "npm run parity" to see what the demo must add.');
};

/* ---------- The demo ---------- */

const sourceFiles = (directory) =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const read = (path) => readFileSync(join(root, path), "utf8");
const readPage = (file) => (existsSync(join(root, file)) ? read(file) : undefined);

const waitForDemo = async () => {
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
      return true;
    } catch {
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

/** Loads the page of an endpoint and checks it */
const checkPage = async (reference, path, entry) => {
  const { pagePath } = pageRequest(path, entry);
  let html;
  try {
    const response = await fetch(baseUrl + pagePath, {
      signal: AbortSignal.timeout(60000),
    });
    html = await response.text();
    if (!response.ok) {
      return fail(`${path}: ${pagePath} gave the status ${response.status}`);
    }
  } catch (error) {
    return fail(`${path}: cannot load ${pagePath} (${error.message})`);
  }
  report(checkPageHtml(reference, path, entry, html));
};

/* ---------- The checks ---------- */

/** Runs the checks, and returns `true` if all of them pass */
const runChecks = async () => {
  if (!existsSync(snapshotPath)) {
    console.log('parity/api-reference.json does not exist. Run "npm run parity:update" first.');
    return false;
  }
  const reference = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const covered = coveredEntries(coverage);

  console.log(
    `Parity check of the demo against the API.Bible API reference, version ${reference.version}`,
  );

  section("1. Endpoints: the reference and the manifest have the same endpoints");
  report(checkEndpoints(reference, coverage));

  section("2. Parameters: the reference and the manifest have the same query parameters");
  report(checkParameters(reference, covered));

  section("3. Source: the demo has a page for each covered endpoint and a control for each parameter");
  //Parameters that many pages use are in the shared files, not in the page
  const shared = sourceFiles("utils").map(read).join("\n");
  report(checkSource(reference, covered, readPage, shared));

  if (live) {
    section(`4. Reference: the published reference is the same as the snapshot (${REFERENCE_URL})`);
    try {
      const differences = referenceDifferences(reference, await fetchReference());
      if (differences.length) {
        for (const difference of differences) fail(difference);
        console.log('        Run "npm run parity:update", then "npm run parity".');
      } else {
        pass(`${Object.keys(reference.endpoints).length} endpoints, no differences`);
      }
    } catch (error) {
      fail(`cannot get the published reference (${error.message})`);
    }

    section(`5. Pages: each covered page sends the API request that the manifest describes (${baseUrl})`);
    if (await waitForDemo()) {
      for (const [path, entry] of covered) {
        await checkPage(reference, path, entry);
      }
    } else {
      fail(`cannot connect to the demo at ${baseUrl}. Start it with "npm run dev" or "npm run start".`);
    }
  } else {
    console.log('\n4. Reference and 5. Pages: not run. Use "npm run parity:live" with the demo running.');
  }

  console.log(`\n${passes} passed, ${failures} failed`);
  return failures === 0;
};

//Set the exit code and let Node stop by itself. `process.exit()` immediately after a
//network request can stop Node on Windows with an error.
if (update) {
  await runUpdate();
} else {
  process.exitCode = (await runChecks()) ? 0 : 1;
}
