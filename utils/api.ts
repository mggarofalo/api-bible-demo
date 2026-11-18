import { createBibleClient } from "@americanbible/api-bible-sdk";
import { AsyncLocalStorage } from "node:async_hooks";
import { removeApiDefaults } from "./apiDefaults";

/**
 * The HTTP request sent to API.Bible for a single call, and the response it returned
 */
export type Exchange = {
  request: {
    method: string;
    url: string;
    headers: [name: string, value: string][];
  };
  response: {
    status: number;
    statusText: string;
    durationMs: number;
    headers: [name: string, value: string][];
  };
};

type Trace = {
  /** Query parameters to add to each request, for parameters that the SDK does not have */
  extraQuery: Record<string, string>;
  recorded: { exchange: Exchange; body: unknown }[];
};

//Headers whose values must never be shown on a page
const SECRET_HEADERS = ["api-key", "authorization"];

//Holds the data of a single `traced` call, keeping concurrent page renders apart
const traces = new AsyncLocalStorage<Trace>();

/**
 * Stand-in for `fetch` that the SDK uses for each request. It does three things:
 *   - Adds the query parameters that the SDK cannot send (see `traced`).
 *   - Removes the query parameters that have the default value of the API, so each
 *     request shows only the parameters that change the response.
 *   - Records the request and its response, when it is inside a `traced` call.
 */
const recordingFetch: typeof fetch = async (input, init) => {
  const trace = traces.getStore();

  const url = new URL(new Request(input).url);
  for (const [name, value] of Object.entries(trace?.extraQuery ?? {})) {
    url.searchParams.set(name, value);
  }
  removeApiDefaults(url);

  if (!trace) {
    return fetch(url, init);
  }

  const request = new Request(url, init);
  const started = performance.now();
  const response = await fetch(url, init);
  const durationMs = Math.round(performance.now() - started);

  //Read a copy of the body, leaving the original response for the SDK
  const text = await response.clone().text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    //Not JSON, keep the text
  }

  trace.recorded.push({
    body,
    exchange: {
      request: {
        method: request.method,
        url: request.url,
        headers: [...request.headers].map(([name, value]) => [
          name,
          SECRET_HEADERS.includes(name.toLowerCase()) ? "<your API key>" : value,
        ]),
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        durationMs,
        headers: [...response.headers],
      },
    },
  });

  return response;
};

export const client = createBibleClient({
  apiKey: process.env.API_BIBLE_API_KEY!,
  //Make one attempt per request. By default the SDK makes up to 3 attempts on
  //rate limits and server errors, which multiplies calls when the API is busy.
  retry: { maxAttempts: 1 },
  fetch: recordingFetch,
});

/**
 * Runs an SDK call and returns its result along with what went over the wire:
 *   - `exchange`: the HTTP request and response (status, headers, timing)
 *   - `body`: the response body exactly as API.Bible returned it
 *
 * Pages use this to show the request, response and raw JSON behind their content.
 *
 * @param call        The SDK call.
 * @param extraQuery  Query parameters that the API has but the SDK does not. They are
 *                    added to the request, so the demo can show the full API.
 *
 * @example
 *   const { data: verse, exchange, body } = await traced(
 *     () => client.verses.get(bibleId, verseId),
 *     { "use-org-id": "true" },
 *   );
 */
export async function traced<T extends object>(
  call: () => Promise<T>,
  extraQuery: Record<string, string> = {},
): Promise<T & { exchange?: Exchange; body: object }> {
  const trace: Trace = { extraQuery, recorded: [] };
  const result = await traces.run(trace, call);
  const last = trace.recorded.at(-1);

  return {
    ...result,
    exchange: last?.exchange,
    //Fall back to the SDK's result if the body wasn't recorded as JSON
    body: typeof last?.body === "object" && last.body ? last.body : result,
  };
}
