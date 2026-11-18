/**
 * The API.Bible API key of the demo. This file is the only place that reads the key
 * from the environment, and the only place that decides if the key is set.
 *
 * The key is for the server only. Do not send its value to the browser. The result of
 * `isApiKeySet` is the only data about the key that a page can show.
 */

/** Value of the key in the `.env.example` file. It is an example, not a key. */
export const API_KEY_PLACEHOLDER = "<redacted>";

/**
 * Gets the API key. Returns `undefined` when the key is not set: the variable is
 * absent, it is empty, or it has the value of the `.env.example` file.
 */
export const getApiKey = (): string | undefined => {
  const key = process.env.API_BIBLE_API_KEY?.trim();
  return key && key !== API_KEY_PLACEHOLDER ? key : undefined;
};

/** Tells if the API key is set */
export const isApiKeySet = (): boolean => getApiKey() !== undefined;
