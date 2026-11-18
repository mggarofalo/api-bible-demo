import { createBibleClient } from "@americanbible/api-bible-sdk";
import { AsyncLocalStorage } from "node:async_hooks";

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

//Headers whose values must never be shown on a page
const SECRET_HEADERS = ["api-key", "authorization"];

//Collects the exchanges made inside a single `traced` call, keeping concurrent page renders apart
const exchanges = new AsyncLocalStorage<{ exchange: Exchange; body: unknown }[]>();

/**
 * Stand-in for `fetch` that records each request made inside a `traced` call, along
 * with its response. Outside of `traced` it behaves exactly like `fetch`.
 */
const recordingFetch: typeof fetch = async (input, init) => {
  const recorded = exchanges.getStore();
  if (!recorded) {
    return fetch(input, init);
  }

  const request = new Request(input, init);
  const started = performance.now();
  const response = await fetch(input, init);
  const durationMs = Math.round(performance.now() - started);

  //Read a copy of the body, leaving the original response for the SDK
  const text = await response.clone().text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    //Not JSON, keep the text
  }

  recorded.push({
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
 * @example
 *   const { data: verse, exchange, body } = await traced(() =>
 *     client.verses.get(bibleId, verseId),
 *   );
 */
export async function traced<T extends object>(
  call: () => Promise<T>,
): Promise<T & { exchange?: Exchange; body: object }> {
  const recorded: { exchange: Exchange; body: unknown }[] = [];
  const result = await exchanges.run(recorded, call);
  const last = recorded.at(-1);

  return {
    ...result,
    exchange: last?.exchange,
    //Fall back to the SDK's result if the body wasn't recorded as JSON
    body: typeof last?.body === "object" && last.body ? last.body : result,
  };
}
