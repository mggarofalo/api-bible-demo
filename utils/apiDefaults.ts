import { findEndpoint } from "./apiReference";

/**
 * Returns the default values of the API for the query parameters of an endpoint, from
 * the snapshot of the API reference.
 *
 * @param pathname  Path of the API request, or of the demo page (the two agree)
 */
export const getApiDefaults = (pathname: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(findEndpoint(pathname)?.endpoint.parameters ?? {}).flatMap(
      ([name, parameter]) =>
        parameter.default === undefined ? [] : [[name, parameter.default]],
    ),
  );

/**
 * Removes the query parameters of an API request that have the default value of the
 * API. The API gives the same response without them, so the request shows only the
 * parameters that change the response.
 */
export const removeApiDefaults = (url: URL) => {
  for (const [name, defaultValue] of Object.entries(
    getApiDefaults(url.pathname),
  )) {
    if (url.searchParams.get(name) === defaultValue) {
      url.searchParams.delete(name);
    }
  }
  return url;
};
