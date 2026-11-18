#!/usr/bin/env node
/**
 * Parity check: makes sure that this demo stays in sync with the API.Bible SDK.
 *
 *   npm run parity         Static checks. No server and no API key are necessary.
 *   npm run parity:live    Static checks, then live checks against a running demo.
 *
 * Static checks (fast, run on every change):
 *   1. Methods     Each method of the SDK client is in parity/coverage.mjs, and each
 *                  entry of the manifest is a method that the SDK has.
 *   2. Parameters  Each parameter of each method (read from the type definitions of
 *                  the SDK) is in the manifest, and the manifest has no parameter
 *                  that the SDK does not have.
 *   3. Calls       Each covered method is called in the source code of the demo.
 *
 * Live checks (need a running demo with an API key, run on a schedule):
 *   4. Pages       Each covered page loads, with every parameter set to its sample
 *                  value. The API request that the page made must have:
 *                    - the status 200
 *                    - the same path as the page (the paths of the demo agree with the API)
 *                    - each parameter of the manifest, with the expected value
 *                    - no parameter that the manifest does not have
 *
 * A static failure means that the SDK changed, or the demo did. A live failure means
 * that the live API and the SDK do not agree, or that a page does not send the request
 * that its controls show.
 *
 * Options:
 *   --live               Also run the live checks.
 *   --base-url=<url>     Address of the running demo. Default: http://localhost:3000
 *   --wait=<seconds>     Wait up to this time for the demo to start. Default: 0
 *
 * The exit code is 1 if a check fails, and 0 if all checks pass.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { coverage } from "../parity/coverage.mjs";

const SDK = "@americanbible/api-bible-sdk";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ??
  fallback;
const live = args.includes("--live");
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

/* ---------- The SDK: methods and parameters ---------- */

/** Lists the methods of the SDK client as `resource.method`, with the class of each resource */
const readSdkMethods = () => {
  const { createBibleClient } = require(SDK);
  //The key is not used. No request is sent.
  const client = createBibleClient({ apiKey: "parity-check" });
  const methods = new Map();

  for (const [resource, handle] of Object.entries(client)) {
    const prototype = Object.getPrototypeOf(handle);
    for (const method of Object.getOwnPropertyNames(prototype)) {
      if (method !== "constructor" && typeof handle[method] === "function") {
        methods.set(`${resource}.${method}`, handle.constructor.name);
      }
    }
  }
  return methods;
};

/** Reads the type definitions of the SDK, without comments */
const readSdkTypes = () => {
  const entry = require.resolve(SDK);
  const file = join(dirname(entry), "index.d.ts");
  return readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
};

/** Returns the text between the `{` at `start` and the `}` that closes it */
const block = (text, start) => {
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    if (text[index] === "{") depth++;
    if (text[index] === "}" && --depth === 0) {
      return text.slice(start + 1, index);
    }
  }
  return null;
};

/** Returns the field names of a `type X = {...}` or `interface X {...}`, and follows `type X = Y` */
const typeFields = (types, name, seen = new Set()) => {
  if (seen.has(name)) return null;
  seen.add(name);

  const alias = types.match(new RegExp(`\\btype ${name} = (\\w+);`));
  if (alias) return typeFields(types, alias[1], seen);

  const declaration = types.match(
    new RegExp(`\\b(?:type ${name} = |interface ${name} )\\{`),
  );
  if (!declaration) return null;

  const body = block(types, declaration.index + declaration[0].length - 1);
  if (body === null) return null;

  //Keep only the fields at the top level of the type
  let depth = 0;
  let topLevel = "";
  for (const character of body) {
    if (character === "{") depth++;
    if (depth === 0) topLevel += character;
    if (character === "}") depth--;
  }
  return [...topLevel.matchAll(/(\w+)\??:/g)].map((match) => match[1]);
};

/**
 * Returns the parameter names of a method: the fields of its `params` argument.
 * Returns an empty list for a method without `params`, and `null` if the method
 * is not in the type definitions.
 */
const methodParams = (types, className, method) => {
  const declaration = types.match(new RegExp(`declare class ${className} \\{`));
  if (!declaration) return null;
  const body = block(types, declaration.index + declaration[0].length - 1);
  const signature = body?.match(new RegExp(`\\n\\s*${method}\\(([^)]*)\\)`));
  if (!signature) return null;

  const paramsType = signature[1].match(/\bparams\??: (\w+)/);
  return paramsType ? typeFields(types, paramsType[1]) : [];
};

/* ---------- The demo: source code ---------- */

const sourceFiles = (directory) =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

/* ---------- Static checks ---------- */

const sdkMethods = readSdkMethods();
const sdkTypes = readSdkTypes();
//The SDK does not export its package.json, so read the file from the folder of the SDK
const sdkVersion = JSON.parse(
  readFileSync(join(root, "node_modules", SDK, "package.json"), "utf8"),
).version;
const covered = Object.entries(coverage).filter(([, entry]) => !entry.deferred);

console.log(`Parity check of the demo against ${SDK} ${sdkVersion}`);

section("1. Methods: the SDK and the manifest have the same methods");
for (const method of sdkMethods.keys()) {
  const entry = coverage[method];
  if (!entry) {
    fail(`${method} is in the SDK, but not in parity/coverage.mjs`);
  } else if (entry.deferred) {
    pass(`${method} (deferred: ${entry.deferred})`);
  } else if (!entry.route) {
    fail(`${method} has no "route" and no "deferred" reason`);
  } else {
    pass(method);
  }
}
for (const method of Object.keys(coverage)) {
  if (!sdkMethods.has(method)) {
    fail(`${method} is in parity/coverage.mjs, but not in the SDK`);
  }
}

section("2. Parameters: the SDK and the manifest have the same parameters");
for (const [method, entry] of covered) {
  if (!sdkMethods.has(method)) continue;
  const sdkParams = methodParams(
    sdkTypes,
    sdkMethods.get(method),
    method.split(".")[1],
  );
  const manifestParams = Object.keys(entry.params ?? {});

  if (sdkParams === null) {
    fail(`${method}: cannot read its parameters from the type definitions of the SDK`);
    continue;
  }
  const missing = sdkParams.filter((name) => !manifestParams.includes(name));
  const unknown = manifestParams.filter((name) => !sdkParams.includes(name));
  for (const name of missing) {
    fail(`${method}: the SDK has the parameter "${name}", but the manifest does not`);
  }
  for (const name of unknown) {
    fail(`${method}: the manifest has the parameter "${name}", but the SDK does not`);
  }
  if (!missing.length && !unknown.length) {
    pass(`${method} (${sdkParams.length ? sdkParams.join(", ") : "no parameters"})`);
  }
}

section("3. Calls: the demo calls each covered method");
const sources = [...sourceFiles("app"), ...sourceFiles("utils")].map((path) => ({
  path,
  text: readFileSync(join(root, path), "utf8"),
}));
for (const [method] of covered) {
  const [resource, name] = method.split(".");
  const call = new RegExp(`client\\s*\\.\\s*${resource}\\s*\\.\\s*${name}\\(`);
  const callers = sources.filter(({ text }) => call.test(text));
  if (callers.length) {
    pass(`${method} (${callers.map(({ path }) => path.replaceAll("\\", "/")).join(", ")})`);
  } else {
    fail(`${method}: no file in app/ or utils/ calls client.${method}()`);
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

const checkPage = async (method, entry) => {
  const params = Object.values(entry.params ?? {}).filter(
    (param) => !param.deferred,
  );
  const query = new URLSearchParams(params.map(({ name, sample }) => [name, sample]));
  const pagePath = entry.route + (params.length ? `?${query}` : "");

  let html;
  try {
    const response = await fetch(baseUrl + pagePath, {
      signal: AbortSignal.timeout(60000),
    });
    html = await response.text();
    if (!response.ok) {
      return fail(`${method}: ${pagePath} gave the status ${response.status}`);
    }
  } catch (error) {
    return fail(`${method}: cannot load ${pagePath} (${error.message})`);
  }

  //Each page writes the API request that it made into these attributes
  const requestUrl = html.match(/data-api-request="([^"]*)"/)?.[1];
  const status = html.match(/data-api-status="([^"]*)"/)?.[1];
  if (!requestUrl) {
    return fail(`${method}: ${pagePath} does not show an API request. The page or the API call failed.`);
  }

  const request = new URL(decodeHtml(requestUrl));
  const problems = [];
  if (status !== "200") {
    problems.push(`the API gave the status ${status}`);
  }
  if (request.pathname !== `/v1${entry.route}`) {
    problems.push(`the API path is ${request.pathname}, not /v1${entry.route}`);
  }
  for (const { name, sample, wire = name, expect = sample } of params) {
    const sent = request.searchParams.get(wire);
    if (sent !== expect) {
      problems.push(
        `"${wire}" is ${sent === null ? "absent" : `"${sent}"`} in the API request, not "${expect}"`,
      );
    }
  }
  const known = params.map(({ name, wire = name }) => wire);
  for (const name of request.searchParams.keys()) {
    if (!known.includes(name)) {
      problems.push(`the API request has "${name}", which is not in the manifest`);
    }
  }

  if (problems.length) {
    for (const problem of problems) fail(`${method}: ${problem}`);
  } else {
    pass(`${method} → ${request.pathname}${request.search}`);
  }
};

if (live) {
  section(`4. Pages: each covered page sends the API request that the manifest describes (${baseUrl})`);
  if (await waitForDemo()) {
    for (const [method, entry] of covered) {
      await checkPage(method, entry);
    }
  } else {
    fail(`cannot connect to the demo at ${baseUrl}. Start it with "npm run dev" or "npm run start".`);
  }
} else {
  console.log('\n4. Pages: not run. Use "npm run parity:live" with the demo running.');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
