import {
  ApiError,
  NetworkError,
  NotFoundError,
  ServerError,
} from "@americanbible/api-bible-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

//A small stand-in for the data cache of Next.js. It keeps each result by its key, and it
//does not keep a call that throws, like the real cache.
const cache = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const unstable_cache = vi.fn<
    (
      fn: () => Promise<unknown>,
      keyParts: string[],
      options: { revalidate?: number; tags?: string[] },
    ) => () => Promise<unknown>
  >(
    (fn, keyParts) =>
      async () => {
        const key = JSON.stringify(keyParts);
        if (store.has(key)) {
          return store.get(key);
        }
        const value = await fn();
        store.set(key, value);
        return value;
      },
  );
  return { store, unstable_cache };
});

vi.mock("next/cache", () => ({ unstable_cache: cache.unstable_cache }));

const API = "https://rest.api.bible/v1";

const verse = {
  id: "GEN.1.1",
  bibleId: "bible-1",
  bookId: "GEN",
  chapterId: "GEN.1",
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    statusText: "OK",
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });

//Stubs global fetch. Each call gets the response that `respond` makes.
const stubFetch = (
  respond: (url: string) => Response | Promise<Response> = () =>
    jsonResponse({ data: [] }),
) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    respond(String(input)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

//Loads a new copy of the module, so it reads the environment again
const loadApi = async (env: Record<string, string> = {}) => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();
  return import("@/utils/api");
};

//Loads a new copy of the module, and gives the fetch that the module hands to the SDK
const loadApiWithSdkFetch = async () => {
  let sdkFetch: typeof fetch | undefined;
  vi.doMock("@americanbible/api-bible-sdk", async (importOriginal) => {
    const sdk = await importOriginal<typeof import("@americanbible/api-bible-sdk")>();
    return {
      ...sdk,
      createBibleClient: (config: Parameters<typeof sdk.createBibleClient>[0]) => {
        sdkFetch = config.fetch;
        return sdk.createBibleClient(config);
      },
    };
  });
  try {
    const api = await loadApi();
    return { ...api, sdkFetch: sdkFetch! };
  } finally {
    vi.doUnmock("@americanbible/api-bible-sdk");
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  cache.store.clear();
  cache.unstable_cache.mockClear();
});

describe("client", () => {
  it("sends the request with the API key to the API", async () => {
    const fetchMock = stubFetch();
    const { client } = await loadApi();

    await client.verses.list("bible-1", "GEN.1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/bibles/bible-1/chapters/GEN.1/verses`);
    expect(new Headers(init.headers).get("api-key")).toBe(
      process.env.API_BIBLE_API_KEY,
    );
  });

  it("works outside a traced call", async () => {
    stubFetch(() => jsonResponse({ data: [verse] }));
    const { client } = await loadApi();

    const { data } = await client.verses.list("bible-1", "GEN.1");

    expect(data).toEqual([verse]);
  });

  it("removes query parameters that have the default value of the API", async () => {
    const fetchMock = stubFetch();
    const { client } = await loadApi();

    await client.books.list("bible-1", {
      includeChapters: false,
      includeChaptersAndSections: true,
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1/bibles/bible-1/books");
    expect(url.searchParams.has("include-chapters")).toBe(false);
    expect(url.searchParams.get("include-chapters-and-sections")).toBe("true");
  });

  it("keeps query parameters that differ from the default value", async () => {
    const fetchMock = stubFetch();
    const { client } = await loadApi();

    await client.books.list("bible-1", { includeChapters: true });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("include-chapters")).toBe("true");
  });

  it("makes one attempt for a server error", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ message: "Busy" }, { status: 503, statusText: "Busy" }),
    );
    const { client } = await loadApi();

    await expect(client.verses.list("bible-1", "GEN.1")).rejects.toBeInstanceOf(
      ServerError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives an error of the API to the SDK with its status", async () => {
    stubFetch(() =>
      jsonResponse({ message: "No such chapter" }, { status: 404 }),
    );
    const { client } = await loadApi();

    const error = await client.verses
      .list("bible-1", "XXX.1")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).message).toBe("No such chapter");
  });

  it("gives a failed fetch to the SDK as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const { client } = await loadApi();

    await expect(client.verses.list("bible-1", "GEN.1")).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("gives no body to the SDK for a status that cannot have a body", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const { client } = await loadApi();

    const error = await client.verses
      .list("bible-1", "GEN.1")
      .catch((caught: unknown) => caught);

    //A body on a 204 response would make `new Response` throw, which the SDK reports
    //as a network error. Without a body the SDK says the body is empty.
    expect(error).not.toBeInstanceOf(NetworkError);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toContain("empty body");
  });

  it("removes the content-length and content-encoding headers of the API", async () => {
    stubFetch(() =>
      jsonResponse(
        { data: [verse] },
        //A length above the limit of the SDK. The SDK would refuse the body if it saw it.
        { headers: { "content-length": "999999999", "content-encoding": "gzip" } },
      ),
    );
    const { client } = await loadApi();

    const { data } = await client.verses.list("bible-1", "GEN.1");

    expect(data).toEqual([verse]);
  });

  it.each([204, 205, 304])(
    "gives a response with no body to the SDK for status %i",
    async (status) => {
      stubFetch(() => new Response(null, { status }));
      const { sdkFetch } = await loadApiWithSdkFetch();

      //A body on one of these statuses would make `new Response` throw
      const response = await sdkFetch(`${API}/bibles/bible-1/books`);

      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
    },
  );

  it.each(["content-length", "content-encoding"])(
    "removes the %s header and keeps the other headers",
    async (name) => {
      stubFetch(() =>
        jsonResponse(
          { data: [] },
          {
            headers: {
              "content-length": "999999999",
              "content-encoding": "gzip",
              "x-request-id": "req-1",
            },
          },
        ),
      );
      const { sdkFetch } = await loadApiWithSdkFetch();

      const response = await sdkFetch(`${API}/bibles/bible-1/books`);

      expect(response.headers.has(name)).toBe(false);
      expect(response.headers.get("x-request-id")).toBe("req-1");
      expect(response.headers.get("content-type")).toBe("application/json");
    },
  );

  it("gives the failure of fetch itself to the SDK when the cache is on", async () => {
    const failure = new TypeError("fetch failed");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw failure;
      }),
    );
    const { sdkFetch } = await loadApiWithSdkFetch();

    //It is not an error from the API, so no stored response exists to give back
    await expect(sdkFetch(`${API}/bibles/bible-1/books`)).rejects.toBe(failure);
    expect(cache.store.size).toBe(0);
  });
});

describe("cache", () => {
  it("uses the URL as the cache key and keeps a response for one day", async () => {
    stubFetch();
    const { client } = await loadApi();

    await client.verses.list("bible-1", "GEN.1");

    expect(cache.unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      ["api-bible", `${API}/bibles/bible-1/chapters/GEN.1/verses`],
      { revalidate: 60 * 60 * 24 },
    );
  });

  it("uses the cache key without the default query parameters", async () => {
    stubFetch();
    const { client } = await loadApi();

    await client.books.list("bible-1", { includeChapters: false });

    expect(cache.unstable_cache.mock.calls[0][1]).toEqual([
      "api-bible",
      `${API}/bibles/bible-1/books`,
    ]);
  });

  it("keeps a response for the time in API_CACHE_SECONDS", async () => {
    stubFetch();
    const { client } = await loadApi({ API_CACHE_SECONDS: "60" });

    await client.verses.list("bible-1", "GEN.1");

    expect(cache.unstable_cache.mock.calls[0][2]).toEqual({ revalidate: 60 });
  });

  it("calls the API one time for the same request", async () => {
    const fetchMock = stubFetch(() => jsonResponse({ data: [verse] }));
    const { client } = await loadApi();

    const first = await client.verses.list("bible-1", "GEN.1");
    const second = await client.verses.list("bible-1", "GEN.1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.data).toEqual(first.data);
  });

  it("calls the API for each different request", async () => {
    const fetchMock = stubFetch();
    const { client } = await loadApi();

    await client.verses.list("bible-1", "GEN.1");
    await client.verses.list("bible-1", "GEN.2");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not keep an error of the API", async () => {
    let status = 500;
    const fetchMock = stubFetch(() =>
      status === 200
        ? jsonResponse({ data: [verse] })
        : jsonResponse({ message: "Failed" }, { status }),
    );
    const { client } = await loadApi();

    await expect(client.verses.list("bible-1", "GEN.1")).rejects.toBeInstanceOf(
      ServerError,
    );
    status = 200;
    const { data } = await client.verses.list("bible-1", "GEN.1");

    expect(data).toEqual([verse]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.store.size).toBe(1);
  });

  it("does not keep a response below 200", async () => {
    //A Response cannot have a status below 200, so this changes the status after it is made
    const fetchMock = stubFetch(() => {
      const response = jsonResponse({ data: [] });
      Object.defineProperty(response, "status", { value: 199 });
      return response;
    });
    const { client } = await loadApi();

    await client.verses.list("bible-1", "GEN.1").catch(() => undefined);
    await client.verses.list("bible-1", "GEN.1").catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.store.size).toBe(0);
  });

  it("does not keep a redirect", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ data: [] }, { status: 301, statusText: "Moved" }),
    );
    const { client } = await loadApi();

    await client.verses.list("bible-1", "GEN.1").catch(() => undefined);
    await client.verses.list("bible-1", "GEN.1").catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.store.size).toBe(0);
  });

  it("does not use the cache when API_CACHE_SECONDS is 0", async () => {
    const fetchMock = stubFetch();
    const { client } = await loadApi({ API_CACHE_SECONDS: "0" });

    await client.verses.list("bible-1", "GEN.1");
    await client.verses.list("bible-1", "GEN.1");

    expect(cache.unstable_cache).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("API_CACHE_SECONDS", () => {
    const ONE_DAY = 60 * 60 * 24;

    //Runs one request with the given value, and gives what the cache saw
    const run = async (value: string | undefined) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      stubFetch();
      vi.stubEnv("API_CACHE_SECONDS", value);
      const { client } = await loadApi();
      await client.verses.list("bible-1", "GEN.1");
      const revalidate = cache.unstable_cache.mock.calls[0]?.[2].revalidate;
      return { warn, revalidate, cacheUsed: cache.unstable_cache.mock.calls.length > 0 };
    };

    it.each([undefined, "", "   "])("uses the default for %j with no warning", async (value) => {
      const { warn, revalidate } = await run(value);

      expect(revalidate).toBe(ONE_DAY);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each(["soon", "-5", "Infinity", "NaN"])(
      "uses the default and warns for %j",
      async (value) => {
        const { warn, revalidate } = await run(value);

        expect(revalidate).toBe(ONE_DAY);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(`It was "${value}"`),
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("API_CACHE_SECONDS"),
        );
      },
    );

    it("stops the cache for 0 with no warning", async () => {
      const { warn, cacheUsed } = await run("0");

      expect(cacheUsed).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });

    it("uses a number of seconds with no warning", async () => {
      const { warn, revalidate } = await run("60");

      expect(revalidate).toBe(60);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe("traced", () => {
  it("returns the result of the call with its exchange and body", async () => {
    const payload = { data: [verse], meta: { fumsId: "f-1" } };
    stubFetch(() =>
      jsonResponse(payload, { headers: { "x-request-id": "req-1" } }),
    );
    const { client, traced } = await loadApi();

    const result = await traced(() => client.verses.list("bible-1", "GEN.1"));

    expect(result.data).toEqual([verse]);
    expect(result.body).toEqual(payload);
    expect(result.exchange?.request).toEqual({
      method: "GET",
      url: `${API}/bibles/bible-1/chapters/GEN.1/verses`,
      headers: expect.arrayContaining([
        ["accept", "application/json"],
        ["api-key", "<your API key>"],
      ]),
    });
    expect(result.exchange?.response).toMatchObject({
      status: 200,
      statusText: "OK",
      headers: expect.arrayContaining([
        ["content-type", "application/json"],
        ["x-request-id", "req-1"],
      ]),
    });
    expect(result.exchange?.response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("gives the time that the API took as the duration", async () => {
    let time = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    //The API answers 250.4 ms after the request starts
    stubFetch(() => {
      time = 1_250.4;
      return jsonResponse({ data: [verse] });
    });
    const { client, traced } = await loadApi();

    const { exchange } = await traced(() =>
      client.verses.list("bible-1", "GEN.1"),
    );

    expect(exchange?.response.durationMs).toBe(250);
  });

  it("never puts the API key in the exchange", async () => {
    vi.stubEnv("API_BIBLE_API_KEY", "secret-key-123");
    stubFetch();
    const { client, traced } = await loadApi();

    const { exchange } = await traced(() =>
      client.verses.list("bible-1", "GEN.1"),
    );

    expect(JSON.stringify(exchange)).not.toContain("secret-key-123");
  });

  it("hides the value of an authorization header", async () => {
    stubFetch();
    //The SDK sends no authorization header, so this calls its fetch directly
    const { traced, sdkFetch } = await loadApiWithSdkFetch();

    const { exchange } = await traced(async () => {
      await sdkFetch(`${API}/bibles`, {
        headers: { Authorization: "Bearer secret-token", "X-Other": "shown" },
      });
      return {};
    });

    expect(exchange?.request.headers).toEqual([
      ["authorization", "<your API key>"],
      ["x-other", "shown"],
    ]);
  });

  it("records the method of the request", async () => {
    stubFetch();
    const { traced, sdkFetch } = await loadApiWithSdkFetch();

    const { exchange } = await traced(async () => {
      await sdkFetch(`${API}/bibles`, { method: "HEAD" });
      return {};
    });

    expect(exchange?.request.method).toBe("HEAD");
    expect(exchange?.request.headers).toEqual([]);
  });

  it("adds the extra query parameters to the request", async () => {
    const fetchMock = stubFetch();
    const { client, traced } = await loadApi();

    const { exchange } = await traced(
      () => client.verses.list("bible-1", "GEN.1"),
      { "use-org-id": "true" },
    );

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("use-org-id")).toBe("true");
    expect(exchange?.request.url).toBe(
      `${API}/bibles/bible-1/chapters/GEN.1/verses?use-org-id=true`,
    );
  });

  it("removes an extra query parameter that has the default value", async () => {
    const fetchMock = stubFetch();
    const { client, traced } = await loadApi();

    await traced(() => client.books.list("bible-1"), {
      "include-chapters": "false",
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${API}/bibles/bible-1/books`,
    );
  });

  it("adds no extra query parameters outside a traced call", async () => {
    const fetchMock = stubFetch();
    const { client, traced } = await loadApi();

    await traced(() => client.verses.list("bible-1", "GEN.1"), {
      "use-org-id": "true",
    });
    await client.verses.list("bible-1", "GEN.2");

    expect(String(fetchMock.mock.calls[1][0])).toBe(
      `${API}/bibles/bible-1/chapters/GEN.2/verses`,
    );
  });

  it("does not mark a new response as cached", async () => {
    stubFetch();
    const { client, traced } = await loadApi();

    const { exchange } = await traced(() =>
      client.verses.list("bible-1", "GEN.1"),
    );

    expect(exchange?.response).not.toHaveProperty("cachedSecondsAgo");
  });

  it("gives the age of a response from the cache", async () => {
    const fetchMock = stubFetch();
    const { client, traced } = await loadApi();
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);

    await traced(() => client.verses.list("bible-1", "GEN.1"));
    now.mockReturnValue(1_004_400);
    const { exchange } = await traced(() =>
      client.verses.list("bible-1", "GEN.1"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(exchange?.response.cachedSecondsAgo).toBe(4);
    expect(exchange?.request.url).toBe(
      `${API}/bibles/bible-1/chapters/GEN.1/verses`,
    );
  });

  it("returns the exchange of the last request of the call", async () => {
    stubFetch(() => jsonResponse({ data: [] }));
    const { client, traced } = await loadApi();

    const { exchange } = await traced(async () => {
      await client.verses.list("bible-1", "GEN.1");
      return client.verses.list("bible-1", "GEN.2");
    });

    expect(exchange?.request.url).toBe(
      `${API}/bibles/bible-1/chapters/GEN.2/verses`,
    );
  });

  it("keeps the exchanges of concurrent calls apart", async () => {
    //The first request gets its response after the second one
    stubFetch(async (url) => {
      const slow = url.includes("bible-slow");
      await new Promise((resolve) => setTimeout(resolve, slow ? 30 : 0));
      return jsonResponse({
        data: [{ ...verse, bibleId: slow ? "bible-slow" : "bible-fast" }],
      });
    });
    const { client, traced } = await loadApi();

    const [slow, fast] = await Promise.all([
      traced(() => client.verses.list("bible-slow", "GEN.1"), { a: "1" }),
      traced(() => client.verses.list("bible-fast", "GEN.1"), { b: "2" }),
    ]);

    expect(slow.exchange?.request.url).toBe(
      `${API}/bibles/bible-slow/chapters/GEN.1/verses?a=1`,
    );
    expect(slow.body).toEqual({
      data: [{ ...verse, bibleId: "bible-slow" }],
    });
    expect(fast.exchange?.request.url).toBe(
      `${API}/bibles/bible-fast/chapters/GEN.1/verses?b=2`,
    );
    expect(fast.body).toEqual({
      data: [{ ...verse, bibleId: "bible-fast" }],
    });
  });

  it("uses the result as the body when the call makes no request", async () => {
    const { traced } = await loadApi();

    const result = await traced(async () => ({ data: "local" }));

    expect(result.exchange).toBeUndefined();
    expect(result.body).toEqual({ data: "local" });
  });

  it("uses the result as the body when the response is not JSON", async () => {
    stubFetch(
      () =>
        new Response("Service unavailable", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "content-type": "text/plain" },
        }),
    );
    const { client, traced } = await loadApi();

    const result = await traced(() =>
      client.verses
        .list("bible-1", "GEN.1")
        .catch(() => ({ data: [], failed: true })),
    );

    expect(result.exchange?.response.status).toBe(503);
    expect(result.exchange?.response.statusText).toBe("Service Unavailable");
    expect(result.body).toEqual({ data: [], failed: true });
  });

  it("rejects when the call fails", async () => {
    stubFetch(() => jsonResponse({ message: "Not found" }, { status: 404 }));
    const { client, traced } = await loadApi();

    await expect(
      traced(() => client.verses.list("bible-1", "XXX.1")),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
