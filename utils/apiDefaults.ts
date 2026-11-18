import reference from "@/parity/api-reference.json";

type ReferenceParameter = { values?: string[]; default?: string };
type ReferenceEndpoint = { parameters: Record<string, ReferenceParameter> };

/**
 * The default value of each query parameter of each endpoint, from the snapshot of the
 * API reference (parity/api-reference.json). `npm run parity:update` writes the snapshot.
 */
const ENDPOINT_DEFAULTS = Object.entries(
  reference.endpoints as Record<string, ReferenceEndpoint>,
).map(([path, endpoint]) => ({
  //`/bibles/{bibleId}/books` becomes a pattern that agrees with `/v1/bibles/<an ID>/books`.
  //The version is optional, so the pattern also agrees with the path of a demo page.
  pattern: new RegExp(
    `^(?:/v\\d+)?${path
      .split("/")
      .map((part) => (/^\{.+\}$/.test(part) ? "[^/]+" : part))
      .join("/")}$`,
  ),
  defaults: Object.entries(endpoint.parameters).flatMap(([name, parameter]) =>
    parameter.default === undefined ? [] : [[name, parameter.default] as const],
  ),
}));

/**
 * Returns the default values of the API for the query parameters of an endpoint.
 *
 * @param pathname  Path of the API request, or of the demo page (the two agree)
 */
export const getApiDefaults = (pathname: string): Record<string, string> =>
  Object.fromEntries(
    ENDPOINT_DEFAULTS.find(({ pattern }) => pattern.test(pathname))?.defaults ??
      [],
  );

/**
 * Removes the query parameters of an API request that have the default value of the
 * API. The API gives the same response without them, so the request shows only the
 * parameters that change the response.
 */
export const removeApiDefaults = (url: URL) => {
  const endpoint = ENDPOINT_DEFAULTS.find(({ pattern }) =>
    pattern.test(url.pathname),
  );
  for (const [name, defaultValue] of endpoint?.defaults ?? []) {
    if (url.searchParams.get(name) === defaultValue) {
      url.searchParams.delete(name);
    }
  }
  return url;
};
