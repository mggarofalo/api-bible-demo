import { createBibleClient } from "@americanbible/api-bible-sdk";
import { unstable_cache } from "next/cache";
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
    /** Time that the API took to answer, when the demo got the response from the API */
    durationMs: number;
    headers: [name: string, value: string][];
    /**
     * Set when the response came from the cache of the demo, and no call to the API
     * was made for this page view. Gives the age of the response in seconds.
     */
    cachedSecondsAgo?: number;
  };
};

type Trace = {
  /** Query parameters to add to each request, for parameters that the SDK does not have */
  extraQuery: Record<string, string>;
  recorded: { exchange: Exchange; body: unknown }[];
};

/** A response of the API in a form that the cache can keep */
type StoredResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  text: string;
  durationMs: number;
  /** Time of the call to the API, in milliseconds since 1970 */
  fetchedAt: number;
};

//Headers whose values must never be shown on a page
const SECRET_HEADERS = ["api-key", "authorization"];

/**
 * Time that the demo keeps a response of the API, in seconds. The default is one day:
 * the text of a Bible changes very rarely. Set the `API_CACHE_SECONDS` environment
 * variable to change it. The value 0 stops the cache.
 */
const CACHE_SECONDS = Number(process.env.API_CACHE_SECONDS ?? 60 * 60 * 24);

//Holds the data of a single `traced` call, keeping concurrent page renders apart
const traces = new AsyncLocalStorage<Trace>();

/** Thrown for a response that must not go into the cache, such as an error from the API */
class UncachedResponse extends Error {
  constructor(readonly stored: StoredResponse) {
    super("The response is not kept in the cache");
  }
}

/** Calls the API and reads the full response */
const callApi = async (
  url: string,
  init: RequestInit | undefined,
): Promise<StoredResponse> => {
  const started = performance.now();
  const response = await fetch(url, init);
  const text = await response.text();

  return {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers],
    text,
    durationMs: Math.round(performance.now() - started),
    fetchedAt: Date.now(),
  };
};

/**
 * Gets the response for a request. Each different URL calls the API one time. After
 * that, the response comes from the data cache of Next.js until it is `CACHE_SECONDS` old.
 *
 * This keeps the number of calls to the live API small. All the pages of the demo use
 * it, so a request that two pages make (for example the list of verses of a chapter)
 * calls the API one time only. An error from the API is not kept.
 */
const getResponse = async (
  url: string,
  init: RequestInit | undefined,
): Promise<StoredResponse> => {
  if (!CACHE_SECONDS) {
    return callApi(url, init);
  }

  const cached = unstable_cache(
    async () => {
      const stored = await callApi(url, init);
      if (stored.status < 200 || stored.status >= 300) {
        throw new UncachedResponse(stored);
      }
      return stored;
    },
    //The URL contains the path and all the query parameters, so it identifies the request
    ["api-bible", url],
    { revalidate: CACHE_SECONDS },
  );

  try {
    return await cached();
  } catch (error) {
    if (error instanceof UncachedResponse) {
      return error.stored;
    }
    throw error;
  }
};

/**
 * Stand-in for `fetch` that the SDK uses for each request. It does four things:
 *   - Adds the query parameters that the SDK cannot send (see `traced`).
 *   - Removes the query parameters that have the default value of the API, so each
 *     request shows only the parameters that change the response.
 *   - Gets the response from the cache when the demo made the same request before.
 *   - Records the request and its response, when it is inside a `traced` call.
 */
const recordingFetch: typeof fetch = async (input, init) => {
  const trace = traces.getStore();

  const url = new URL(new Request(input).url);
  for (const [name, value] of Object.entries(trace?.extraQuery ?? {})) {
    url.searchParams.set(name, value);
  }
  removeApiDefaults(url);

  const asked = Date.now();
  const stored = await getResponse(url.toString(), init);
  //A response from before this call started came from the cache
  const fromCache = stored.fetchedAt < asked;

  if (trace) {
    let body: unknown = stored.text;
    try {
      body = JSON.parse(stored.text);
    } catch {
      //Not JSON, keep the text
    }

    trace.recorded.push({
      body,
      exchange: {
        request: {
          method: init?.method ?? "GET",
          url: url.toString(),
          headers: [...new Headers(init?.headers)].map(([name, value]) => [
            name,
            SECRET_HEADERS.includes(name.toLowerCase())
              ? "<your API key>"
              : value,
          ]),
        },
        response: {
          status: stored.status,
          statusText: stored.statusText,
          durationMs: stored.durationMs,
          headers: stored.headers,
          ...(fromCache
            ? { cachedSecondsAgo: Math.round((asked - stored.fetchedAt) / 1000) }
            : {}),
        },
      },
    });
  }

  //The SDK reads the response as if it came from the API. Some statuses cannot have a body.
  return new Response([204, 205, 304].includes(stored.status) ? null : stored.text, {
    status: stored.status,
    statusText: stored.statusText,
    headers: stored.headers.filter(
      //The text is not compressed now, so these headers of the API do not apply
      ([name]) => !["content-encoding", "content-length"].includes(name.toLowerCase()),
    ),
  });
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
