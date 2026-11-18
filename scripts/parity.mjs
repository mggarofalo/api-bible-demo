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
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { coverage } from "../parity/coverage.mjs";

const REFERENCE_URL = "https://rest.api.bible/v1/swagger.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(root, "parity", "api-reference.json");

const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ??
  fallback;
const live = args.includes("--live");
const update = args.includes("--update");
const baseUrl = option("base-url", "http://localhost:3000").replace(/\/$/, "");
const waitSeconds = Number(option("wait", "0"));

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

/* ---------- The API reference ---------- */

/**
 * Gets the published API reference and keeps only the data that the parity check
 * uses: each endpoint, its HTTP methods, and its query parameters. For a parameter
 * with fixed values, it keeps the values. For a parameter with a default value, it
 * keeps the default. It also keeps the text: the summary and the description of each
 * endpoint, and the description of each parameter. The demo reads the defaults and the
 * help text from the snapshot (utils/apiReference.ts), so it shows the words of the reference.
 */
const fetchReference = async () => {
  const response = await fetch(REFERENCE_URL, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`${REFERENCE_URL} gave the status ${response.status}`);
  }
  const document = await response.json();

  //A parameter can be a reference to a shared definition (`$ref`)
  const resolve = (parameter) =>
    parameter.$ref
      ? document.components.parameters[parameter.$ref.split("/").pop()]
      : parameter;

  const endpoints = {};
  for (const path of Object.keys(document.paths).sort()) {
    const item = document.paths[path];
    const methods = Object.keys(item)
      .filter((key) => typeof item[key] === "object" && key !== "parameters")
      .sort();

    const parameters = {};
    const pathParameters = {};
    for (const method of methods) {
      for (const parameter of [
        ...(item.parameters ?? []),
        ...(item[method].parameters ?? []),
      ].map(resolve)) {
        if (parameter.in === "path" && parameter.description) {
          pathParameters[parameter.name] = parameter.description.trim();
        }
        if (parameter.in !== "query") continue;
        const values = parameter.schema?.enum ?? parameter.enum;
        const defaultValue = parameter.schema?.default;
        parameters[parameter.name] = {
          ...(values ? { values: values.map(String) } : {}),
          ...(defaultValue === undefined ? {} : { default: String(defaultValue) }),
          ...(parameter.description ? { description: parameter.description.trim() } : {}),
        };
      }
    }
    const operation = item[methods[0]] ?? {};
    endpoints[path] = {
      methods,
      ...(operation.summary ? { summary: operation.summary.trim() } : {}),
      ...(operation.description ? { description: operation.description.trim() } : {}),
      parameters,
      ...(Object.keys(pathParameters).length ? { pathParameters } : {}),
    };
  }

  return { source: REFERENCE_URL, version: document.info?.version ?? "", endpoints };
};

/** Lists the differences between two references, as sentences */
const referenceDifferences = (snapshot, published) => {
  const differences = [];
  const paths = new Set([
    ...Object.keys(snapshot.endpoints),
    ...Object.keys(published.endpoints),
  ]);

  for (const path of [...paths].sort()) {
    const before = snapshot.endpoints[path];
    const after = published.endpoints[path];
    if (!before) {
      differences.push(`${path} is a new endpoint`);
      continue;
    }
    if (!after) {
      differences.push(`${path} is no longer in the reference`);
      continue;
    }
    if (before.summary !== after.summary) {
      differences.push(`${path}: the summary changed to "${after.summary ?? ""}"`);
    }
    if (before.description !== after.description) {
      differences.push(`${path}: the description changed`);
    }
    if (JSON.stringify(before.pathParameters ?? {}) !== JSON.stringify(after.pathParameters ?? {})) {
      differences.push(`${path}: the description of an ID in the path changed`);
    }
    if (before.methods.join() !== after.methods.join()) {
      differences.push(`${path} changed its methods to ${after.methods.join(", ")}`);
    }
    const names = new Set([
      ...Object.keys(before.parameters),
      ...Object.keys(after.parameters),
    ]);
    for (const name of [...names].sort()) {
      const was = before.parameters[name];
      const is = after.parameters[name];
      if (!was) differences.push(`${path} has the new parameter "${name}"`);
      else if (!is) differences.push(`${path} no longer has the parameter "${name}"`);
      else if (was.description !== is.description) {
        differences.push(`${path}: the description of "${name}" changed`);
      } else if (was.default !== is.default) {
        differences.push(
          `${path}: the default of "${name}" changed to ${is.default === undefined ? "no default" : `"${is.default}"`}`,
        );
      } else if ((was.values ?? []).join() !== (is.values ?? []).join()) {
        differences.push(
          `${path}: the values of "${name}" changed to ${(is.values ?? []).join(", ") || "any value"}`,
        );
      }
    }
  }
  return differences;
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

/** Runs the checks, and returns `true` if all of them pass */
const runChecks = async () => {
if (!existsSync(snapshotPath)) {
  console.log('parity/api-reference.json does not exist. Run "npm run parity:update" first.');
  return false;
}
const reference = JSON.parse(readFileSync(snapshotPath, "utf8"));

/* ---------- The demo ---------- */

/** Path of the demo page for an endpoint: `/bibles/{bibleId}` is `app/bibles/[bibleId]/page.tsx` */
const pageFile = (path) =>
  join("app", ...path.split("/").filter(Boolean).map((part) => part.replace(/^\{(.+)\}$/, "[$1]")), "page.tsx");

/** Path of an endpoint with the sample IDs of the manifest */
const samplePath = (path, entry) =>
  path.replace(/\{(\w+)\}/g, (_, name) => entry.ids?.[name] ?? `{${name}}`);

const sourceFiles = (directory) =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const read = (path) => readFileSync(join(root, path), "utf8");
const hasText = (source, text) =>
  source.includes(`"${text}"`) || source.includes(`'${text}'`);

/* ---------- Static checks ---------- */

const covered = Object.entries(coverage).filter(([, entry]) => !entry.deferred);

console.log(
  `Parity check of the demo against the API.Bible API reference, version ${reference.version}`,
);

section("1. Endpoints: the reference and the manifest have the same endpoints");
for (const [path, endpoint] of Object.entries(reference.endpoints)) {
  const entry = coverage[path];
  const unknownMethods = endpoint.methods.filter((method) => method !== "get");
  if (!entry) {
    fail(`${path} is in the reference, but not in parity/coverage.mjs`);
  } else if (entry.deferred) {
    pass(`${path} (deferred: ${entry.deferred})`);
  } else if (unknownMethods.length) {
    fail(`${path} has the method ${unknownMethods.join(", ")}. The demo shows only GET requests.`);
  } else {
    pass(path);
  }
}
for (const path of Object.keys(coverage)) {
  if (!reference.endpoints[path]) {
    fail(`${path} is in parity/coverage.mjs, but not in the reference`);
  }
}

section("2. Parameters: the reference and the manifest have the same query parameters");
for (const [path, entry] of covered) {
  const endpoint = reference.endpoints[path];
  if (!endpoint) continue;
  const referenceParams = Object.keys(endpoint.parameters);
  const manifestParams = Object.keys(entry.params ?? {});

  const missing = referenceParams.filter((name) => !manifestParams.includes(name));
  const unknown = manifestParams.filter((name) => !referenceParams.includes(name));
  for (const name of missing) {
    fail(`${path}: the reference has the parameter "${name}", but the manifest does not`);
  }
  for (const name of unknown) {
    fail(`${path}: the manifest has the parameter "${name}", but the reference does not`);
  }
  //The demo shows the text of the reference as its help text, so the text must be there
  const noText = [
    ...(endpoint.summary ? [] : ["the reference has no summary"]),
    ...(endpoint.description ? [] : ["the reference has no description"]),
    ...referenceParams
      .filter((name) => !endpoint.parameters[name].description)
      .map((name) => `the reference has no description for the parameter "${name}"`),
  ];
  for (const problem of noText) {
    fail(`${path}: ${problem}, so the demo has no help text for it`);
  }
  if (!missing.length && !unknown.length && !noText.length) {
    const deferred = manifestParams.filter((name) => entry.params[name].deferred);
    pass(
      `${path} (${referenceParams.length ? referenceParams.join(", ") : "no parameters"})` +
        (deferred.length ? ` (deferred: ${deferred.join(", ")})` : ""),
    );
  }
}

section("3. Source: the demo has a page for each covered endpoint and a control for each parameter");
//Parameters that many pages use are in the shared files, not in the page
const shared = sourceFiles("utils").map(read).join("\n");
for (const [path, entry] of covered) {
  const file = pageFile(path);
  if (!existsSync(join(root, file))) {
    fail(`${path}: the demo has no page at ${file.replaceAll("\\", "/")}`);
    continue;
  }
  const page = read(file);
  const problems = [];

  if (!entry.sdk) {
    problems.push('the manifest has no "sdk" method');
  } else {
    const [resource, method] = entry.sdk.split(".");
    if (!new RegExp(`client\\s*\\.\\s*${resource}\\s*\\.\\s*${method}\\(`).test(page)) {
      problems.push(`the page does not call client.${entry.sdk}()`);
    }
  }
  for (const [name, param] of Object.entries(entry.params ?? {})) {
    if (param.deferred) continue;
    //A parameter with a different name on the page, such as `page` for `offset`, is checked live
    if (!param.page && !hasText(page, name) && !hasText(shared, name)) {
      problems.push(`the source does not contain the parameter "${name}"`);
    }
    for (const value of reference.endpoints[path]?.parameters[name]?.values ?? []) {
      if (!hasText(page, value) && !hasText(shared, value)) {
        problems.push(`the source does not contain the value "${value}" of "${name}"`);
      }
    }
  }

  if (problems.length) {
    for (const problem of problems) fail(`${path}: ${problem}`);
  } else {
    pass(`${path} → ${file.replaceAll("\\", "/")}`);
  }
}

/* ---------- Live checks ---------- */

const decodeHtml = (text) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

/** Removes the Markdown marks from text of the reference, to compare it with the text of a page */
const decodeMarkdown = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[`*_\\]/g, "");

/** Text with HTML entities decoded, Markdown marks removed and all spaces removed */
const plainText = (text) => decodeHtml(text).replace(/[`*_\\]/g, "").replace(/\s+/g, "");

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

const checkPage = async (path, entry) => {
  const params = Object.entries(entry.params ?? {})
    .filter(([, param]) => !param.deferred)
    .map(([name, param]) => ({ name, ...param }));
  const route = samplePath(path, entry);
  const query = new URLSearchParams(
    params.map(({ name, page = name, sample }) => [page, sample]),
  );
  const pagePath = route + (params.length ? `?${query}` : "");

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

  //Each page writes the API request that it made into these attributes
  const requestUrl = html.match(/data-api-request="([^"]*)"/)?.[1];
  const status = html.match(/data-api-status="([^"]*)"/)?.[1];
  if (!requestUrl) {
    return fail(`${path}: ${pagePath} does not show an API request. The page or the API call failed.`);
  }

  const request = new URL(decodeHtml(requestUrl));
  const problems = [];
  if (status !== "200") {
    problems.push(`the API gave the status ${status}`);
  }
  if (request.pathname !== `/v1${route}`) {
    problems.push(`the API path is ${request.pathname}, not /v1${route}`);
  }
  for (const { name, sample, expect = sample } of params) {
    const sent = request.searchParams.get(name);
    //The demo does not send a value that is the default of the API
    const isDefault = reference.endpoints[path].parameters[name]?.default === expect;
    if (isDefault && sent !== null) {
      problems.push(
        `"${name}" is "${sent}" in the API request, but it is the default of the API and must be absent`,
      );
    } else if (!isDefault && sent !== expect) {
      problems.push(
        `"${name}" is ${sent === null ? "absent" : `"${sent}"`} in the API request, not "${expect}"`,
      );
    }
  }
  for (const name of request.searchParams.keys()) {
    if (!params.some((param) => param.name === name)) {
      problems.push(`the API request has "${name}", which is not in the manifest`);
    }
  }

  //The help text of the page must be the text of the reference
  const pageText = plainText(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " "));
  const endpoint = reference.endpoints[path];
  const shows = (text) => pageText.includes(plainText(decodeMarkdown(text)).slice(0, 80));
  if (endpoint.summary && !shows(endpoint.summary)) {
    problems.push(`the page does not show the summary of the reference ("${endpoint.summary}")`);
  }
  if (endpoint.description && !shows(endpoint.description.split(/\n\s*\n/)[0])) {
    problems.push("the page does not show the description of the reference");
  }
  for (const { name } of params) {
    const description = endpoint.parameters[name]?.description;
    if (description && !shows(description)) {
      problems.push(`the page does not show the description of "${name}" from the reference`);
    }
  }

  if (problems.length) {
    for (const problem of problems) fail(`${path}: ${problem}`);
  } else {
    pass(`${path} → ${request.pathname}${request.search}`);
  }
};

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
      await checkPage(path, entry);
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
