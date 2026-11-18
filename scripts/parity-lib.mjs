/**
 * The logic of the parity check (`scripts/parity.mjs`), without file or network I/O, so
 * that the tests can call it. Each check takes its data as arguments and returns a list
 * of results: `{ ok: true, message }` for a pass, and `{ ok: false, message }` for a failure.
 */
import { join } from "node:path";

/**
 * @typedef {{ ok: boolean, message: string }} Result
 * @typedef {{ values?: string[], default?: string, description?: string }} ReferenceParameter
 * @typedef {{
 *   methods: string[],
 *   summary?: string,
 *   description?: string,
 *   parameters: Record<string, ReferenceParameter>,
 *   pathParameters?: Record<string, string>,
 * }} ReferenceEndpoint
 * @typedef {{ source: string, version: string, endpoints: Record<string, ReferenceEndpoint> }} Reference
 * @typedef {{ sample?: string, page?: string, expect?: string, deferred?: string }} ManifestParameter
 * @typedef {{
 *   ids?: Record<string, string>,
 *   sdk?: string,
 *   params?: Record<string, ManifestParameter>,
 *   deferred?: string,
 * }} ManifestEntry
 */

/** @param {string} message @returns {Result} */
const pass = (message) => ({ ok: true, message });
/** @param {string} message @returns {Result} */
const fail = (message) => ({ ok: false, message });

/* ---------- Options ---------- */

/**
 * Reads the options of the command line
 * @param {string[]} args
 */
export const parseOptions = (args) => {
  /** @param {string} name @param {string} fallback */
  const option = (name, fallback) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ??
    fallback;
  const wait = option("wait", "0");
  const waitSeconds = Number(wait);
  //A wait that is not a number gives a deadline that never comes
  if (wait.trim() === "" || !Number.isFinite(waitSeconds) || waitSeconds < 0) {
    throw new Error(`--wait must be a number of seconds, 0 or more. It was "${wait}".`);
  }
  return {
    live: args.includes("--live"),
    update: args.includes("--update"),
    baseUrl: option("base-url", "http://localhost:3000").replace(/\/$/, ""),
    waitSeconds,
  };
};

/* ---------- The API reference ---------- */

/**
 * Keeps only the data of an OpenAPI document that the parity check uses: each endpoint,
 * its HTTP methods, and its query parameters. For a parameter with fixed values, it keeps
 * the values. For a parameter with a default value, it keeps the default. It also keeps
 * the text: the summary and the description of each endpoint, and the description of
 * each parameter.
 * @param {any} document The OpenAPI document
 * @param {string} source The address of the document
 * @returns {Reference}
 */
export const normalizeReference = (document, source) => {
  //A parameter can be a reference to a shared definition (`$ref`)
  /** @param {any} parameter */
  const resolve = (parameter) =>
    parameter.$ref
      ? document.components.parameters[parameter.$ref.split("/").pop()]
      : parameter;

  /** @type {Record<string, ReferenceEndpoint>} */
  const endpoints = {};
  for (const path of Object.keys(document.paths).sort()) {
    const item = document.paths[path];
    const methods = Object.keys(item)
      .filter((key) => typeof item[key] === "object" && key !== "parameters")
      .sort();

    /** @type {Record<string, ReferenceParameter>} */
    const parameters = {};
    /** @type {Record<string, string>} */
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

  return { source, version: document.info?.version ?? "", endpoints };
};

/**
 * Lists the differences between two references, as sentences
 * @param {Reference} snapshot
 * @param {Reference} published
 * @returns {string[]}
 */
export const referenceDifferences = (snapshot, published) => {
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

/* ---------- The demo ---------- */

/**
 * Path of the demo page for an endpoint: `/bibles/{bibleId}` is `app/bibles/[bibleId]/page.tsx`
 * @param {string} path
 */
export const pageFile = (path) =>
  join("app", ...path.split("/").filter(Boolean).map((part) => part.replace(/^\{(.+)\}$/, "[$1]")), "page.tsx");

/**
 * Path of an endpoint with the sample IDs of the manifest
 * @param {string} path
 * @param {ManifestEntry} entry
 */
export const samplePath = (path, entry) =>
  path.replace(/\{(\w+)\}/g, (_, name) => entry.ids?.[name] ?? `{${name}}`);

/**
 * `true` if the source contains the text as a string literal
 * @param {string} source
 * @param {string} text
 */
export const hasText = (source, text) =>
  source.includes(`"${text}"`) || source.includes(`'${text}'`);

/**
 * The entries of the manifest that are not deferred
 * @param {Record<string, ManifestEntry>} coverage
 * @returns {[string, ManifestEntry][]}
 */
export const coveredEntries = (coverage) =>
  Object.entries(coverage).filter(([, entry]) => !entry.deferred);

/* ---------- Static checks ---------- */

/**
 * 1. Endpoints: the reference and the manifest have the same endpoints
 * @param {Reference} reference
 * @param {Record<string, ManifestEntry>} coverage
 * @returns {Result[]}
 */
export const checkEndpoints = (reference, coverage) => {
  const results = [];
  for (const [path, endpoint] of Object.entries(reference.endpoints)) {
    const entry = coverage[path];
    const unknownMethods = endpoint.methods.filter((method) => method !== "get");
    if (!entry) {
      results.push(fail(`${path} is in the reference, but not in parity/coverage.mjs`));
    } else if (entry.deferred) {
      results.push(pass(`${path} (deferred: ${entry.deferred})`));
    } else if (unknownMethods.length) {
      results.push(fail(`${path} has the method ${unknownMethods.join(", ")}. The demo shows only GET requests.`));
    } else {
      results.push(pass(path));
    }
  }
  for (const path of Object.keys(coverage)) {
    if (!reference.endpoints[path]) {
      results.push(fail(`${path} is in parity/coverage.mjs, but not in the reference`));
    }
  }
  return results;
};

/**
 * 2. Parameters: the reference and the manifest have the same query parameters
 * @param {Reference} reference
 * @param {[string, ManifestEntry][]} covered
 * @returns {Result[]}
 */
export const checkParameters = (reference, covered) => {
  const results = [];
  for (const [path, entry] of covered) {
    const endpoint = reference.endpoints[path];
    if (!endpoint) continue;
    const referenceParams = Object.keys(endpoint.parameters);
    const manifestParams = Object.keys(entry.params ?? {});

    const missing = referenceParams.filter((name) => !manifestParams.includes(name));
    const unknown = manifestParams.filter((name) => !referenceParams.includes(name));
    for (const name of missing) {
      results.push(fail(`${path}: the reference has the parameter "${name}", but the manifest does not`));
    }
    for (const name of unknown) {
      results.push(fail(`${path}: the manifest has the parameter "${name}", but the reference does not`));
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
      results.push(fail(`${path}: ${problem}, so the demo has no help text for it`));
    }
    if (!missing.length && !unknown.length && !noText.length) {
      const params = entry.params ?? {};
      const deferred = manifestParams.filter((name) => params[name].deferred);
      results.push(
        pass(
          `${path} (${referenceParams.length ? referenceParams.join(", ") : "no parameters"})` +
            (deferred.length ? ` (deferred: ${deferred.join(", ")})` : ""),
        ),
      );
    }
  }
  return results;
};

/**
 * 3. Source: the demo has a page for each covered endpoint and a control for each parameter
 * @param {Reference} reference
 * @param {[string, ManifestEntry][]} covered
 * @param {(file: string) => string | undefined} readPage Gives the source of a page file, or `undefined` if the file does not exist
 * @param {string} shared The source of the shared files. Parameters that many pages use are there, not in the page.
 * @returns {Result[]}
 */
export const checkSource = (reference, covered, readPage, shared) => {
  const results = [];
  for (const [path, entry] of covered) {
    const file = pageFile(path);
    const page = readPage(file);
    if (page === undefined) {
      results.push(fail(`${path}: the demo has no page at ${file.replaceAll("\\", "/")}`));
      continue;
    }
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
      for (const problem of problems) results.push(fail(`${path}: ${problem}`));
    } else {
      results.push(pass(`${path} → ${file.replaceAll("\\", "/")}`));
    }
  }
  return results;
};

/* ---------- Live checks ---------- */

/** @param {string} text */
export const decodeHtml = (text) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

/**
 * Removes the Markdown marks from text of the reference, to compare it with the text of a page
 * @param {string} text
 */
export const decodeMarkdown = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[`*_\\]/g, "");

/**
 * Text with HTML entities decoded, Markdown marks removed and all spaces removed
 * @param {string} text
 */
export const plainText = (text) => decodeHtml(text).replace(/[`*_\\]/g, "").replace(/\s+/g, "");

/**
 * The page to load for an endpoint, with every parameter set to its sample value
 * @param {string} path
 * @param {ManifestEntry} entry
 */
export const pageRequest = (path, entry) => {
  const params = Object.entries(entry.params ?? {})
    .filter(([, param]) => !param.deferred)
    .map(([name, param]) => ({ name, ...param }));
  const route = samplePath(path, entry);
  const query = new URLSearchParams(
    params.map(({ name, page = name, sample }) => [page, /** @type {string} */ (sample)]),
  );
  const pagePath = route + (params.length ? `?${query}` : "");
  return { params, route, pagePath };
};

/**
 * 5. Pages: compares the HTML of a loaded page with the manifest and the reference
 * @param {Reference} reference
 * @param {string} path
 * @param {ManifestEntry} entry
 * @param {string} html
 * @returns {Result[]}
 */
export const checkPageHtml = (reference, path, entry, html) => {
  const { params, route, pagePath } = pageRequest(path, entry);

  //Each page writes the API request that it made into these attributes
  const requestUrl = html.match(/data-api-request="([^"]*)"/)?.[1];
  const status = html.match(/data-api-status="([^"]*)"/)?.[1];
  if (!requestUrl) {
    return [fail(`${path}: ${pagePath} does not show an API request. The page or the API call failed.`)];
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

  //A response that contains Scripture has a FUMS token. The page must load the FUMS script to report it.
  if (html.includes("fumsToken") && !html.includes("fumsV3.min.js")) {
    problems.push("the response has a FUMS token, but the page does not load the FUMS script");
  }

  //The help text of the page must be the text of the reference
  const pageText = plainText(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " "));
  const endpoint = reference.endpoints[path];
  /** @param {string} text */
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
    return problems.map((problem) => fail(`${path}: ${problem}`));
  }
  return [pass(`${path} → ${request.pathname}${request.search}`)];
};
