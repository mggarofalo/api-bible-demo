import { describe, expect, it } from "vitest";
import {
  checkEndpoints,
  checkPageHtml,
  checkParameters,
  checkSource,
  coveredEntries,
  decodeHtml,
  decodeMarkdown,
  hasText,
  normalizeReference,
  pageFile,
  pageRequest,
  parseOptions,
  plainText,
  REFERENCE_URL,
  referenceDifferences,
  samplePath,
} from "@/scripts/parity-lib.mjs";

type Reference = Parameters<typeof referenceDifferences>[0];
type Coverage = Parameters<typeof checkEndpoints>[1];

//A small reference with two endpoints, in the form of parity/api-reference.json
const reference = (): Reference => ({
  source: "https://example.test/swagger.json",
  version: "1.2.3",
  endpoints: {
    "/bibles": {
      methods: ["get"],
      summary: "Get Bibles",
      description: "Gets a list of Bibles.",
      parameters: {
        language: { description: "ISO 639-3 language code" },
        "include-full-details": {
          values: ["true", "false"],
          default: "false",
          description: "Include *full* details",
        },
      },
    },
    "/bibles/{bibleId}": {
      methods: ["get"],
      summary: "Get a Bible",
      description: "Gets one Bible.\n\nMore text that the page does not show.",
      parameters: {},
      pathParameters: { bibleId: "Id of the Bible" },
    },
  },
});

const ok = (message: string) => ({ ok: true, message });
const failure = (message: string) => ({ ok: false, message });

describe("parseOptions", () => {
  it("has defaults", () => {
    expect(parseOptions([])).toEqual({
      live: false,
      update: false,
      baseUrl: "http://localhost:3000",
      referenceUrl: "https://rest.api.bible/v1/swagger.json",
      waitSeconds: 0,
    });
    expect(REFERENCE_URL).toBe("https://rest.api.bible/v1/swagger.json");
  });

  it("reads the flags and the values", () => {
    expect(
      parseOptions([
        "--live",
        "--update",
        "--base-url=https://demo.test/",
        "--reference-url=http://127.0.0.1:8080/v1/swagger.json?a=b",
        "--wait=60",
      ]),
    ).toEqual({
      live: true,
      update: true,
      baseUrl: "https://demo.test",
      referenceUrl: "http://127.0.0.1:8080/v1/swagger.json?a=b",
      waitSeconds: 60,
    });
  });

  //The reference is a document, so its address keeps a slash at the end
  it("keeps the reference URL as it is", () => {
    expect(parseOptions(["--reference-url=https://ref.test/docs/"]).referenceUrl).toBe(
      "https://ref.test/docs/",
    );
  });

  it.each(["", "swagger.json", "ftp://ref.test/swagger.json", "file:///C:/swagger.json", "http://", "https:// x"])(
    'refuses "--reference-url=%s", which is not an http or https address',
    (url) => {
      expect(() => parseOptions([`--reference-url=${url}`])).toThrow(
        `--reference-url must be an http or https address. It was "${url}".`,
      );
    },
  );

  it("reads --live without --update", () => {
    const options = parseOptions(["--live"]);
    expect(options.live).toBe(true);
    expect(options.update).toBe(false);
  });

  it("reads --update without --live", () => {
    const options = parseOptions(["--update"]);
    expect(options.update).toBe(true);
    expect(options.live).toBe(false);
  });

  it("keeps an = in a value", () => {
    expect(parseOptions(["--base-url=http://demo.test/?a=b"]).baseUrl).toBe(
      "http://demo.test/?a=b",
    );
  });

  it("ignores an option without a value", () => {
    expect(parseOptions(["--base-url", "--wait"]).baseUrl).toBe("http://localhost:3000");
  });

  //A wait that is not a number made a deadline that never came: the live check did not stop
  it.each(["soon", "", " ", "-1", "Infinity", "1e999"])(
    'refuses "--wait=%s", which is not a number of seconds',
    (wait) => {
      expect(() => parseOptions([`--wait=${wait}`])).toThrow(/--wait must be a number/);
    },
  );

  it.each([
    ["0", 0],
    ["1.5", 1.5],
    ["60", 60],
  ])('accepts "--wait=%s"', (wait, seconds) => {
    expect(parseOptions([`--wait=${wait}`]).waitSeconds).toBe(seconds);
  });
});

describe("normalizeReference", () => {
  const document = {
    info: { version: "7.0" },
    components: {
      parameters: {
        Language: {
          name: "language",
          in: "query",
          description: "  Language code \n",
          schema: { type: "string" },
        },
      },
    },
    paths: {
      "/zeta": {
        get: { summary: "Zeta", parameters: [] },
      },
      "/bibles/{bibleId}": {
        parameters: [
          { name: "bibleId", in: "path", description: " Id of the Bible " },
          { name: "noText", in: "path" },
        ],
        get: {
          summary: " Get a Bible ",
          description: " One Bible ",
          parameters: [
            { $ref: "#/components/parameters/Language" },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
            },
            {
              name: "sort",
              in: "query",
              description: "Sort order",
              schema: { enum: ["name", 2], default: "name" },
            },
            { name: "legacy", in: "query", enum: ["a", "b"] },
            { name: "api-key", in: "header", description: "Key" },
          ],
        },
        post: { parameters: [{ name: "body", in: "query" }] },
        //`summary` is not a method. `put` and `delete` have the names of methods, but
        //they are not operations (objects), so they are not methods either.
        summary: "A string at the path level is not a method",
        put: "A string is not an operation",
        delete: null,
      },
    },
  };

  it("keeps the endpoints, methods, parameters and text", () => {
    const result = normalizeReference(document, "https://example.test/swagger.json");
    expect(result.source).toBe("https://example.test/swagger.json");
    expect(result.version).toBe("7.0");
    expect(Object.keys(result.endpoints)).toEqual(["/bibles/{bibleId}", "/zeta"]);
    expect(result.endpoints["/bibles/{bibleId}"]).toEqual({
      methods: ["get", "post"],
      summary: "Get a Bible",
      description: "One Bible",
      parameters: {
        language: { description: "Language code" },
        limit: { default: "10" },
        sort: { values: ["name", "2"], default: "name", description: "Sort order" },
        legacy: { values: ["a", "b"] },
        body: {},
      },
      pathParameters: { bibleId: "Id of the Bible" },
    });
  });

  it("keeps a default that is 0, false or an empty string", () => {
    const result = normalizeReference(
      {
        paths: {
          "/a": {
            get: {
              parameters: [
                { name: "zero", in: "query", schema: { default: 0 } },
                { name: "off", in: "query", schema: { default: false } },
                { name: "empty", in: "query", schema: { default: "" } },
                { name: "none", in: "query", schema: {} },
              ],
            },
          },
        },
      },
      "x",
    );
    expect(result.endpoints["/a"].parameters).toEqual({
      zero: { default: "0" },
      off: { default: "false" },
      empty: { default: "" },
      none: {},
    });
  });

  it("leaves out the text and the path parameters that are not there", () => {
    const result = normalizeReference(document, "x");
    expect(result.endpoints["/zeta"]).toEqual({
      methods: ["get"],
      summary: "Zeta",
      parameters: {},
    });
  });

  it("gives an empty version and an empty operation when they are missing", () => {
    const result = normalizeReference({ paths: { "/empty": {} } }, "x");
    expect(result.version).toBe("");
    expect(result.endpoints["/empty"]).toEqual({ methods: [], parameters: {} });
  });

  it("counts only the HTTP methods of a path item", () => {
    const result = normalizeReference(
      {
        paths: {
          "/a": {
            servers: [{ url: "https://other.test" }],
            "x-internal": { note: "An extension is not a method" },
            parameters: [{ name: "shared", in: "query" }],
            get: {},
            put: {},
            post: {},
            delete: {},
            options: {},
            head: {},
            patch: {},
            trace: {},
          },
        },
      },
      "x",
    );
    expect(result.endpoints["/a"]).toEqual({
      methods: ["delete", "get", "head", "options", "patch", "post", "put", "trace"],
      parameters: { shared: {} },
    });
  });

  it("uses the summary of the first method in alphabetical order", () => {
    const result = normalizeReference(
      { paths: { "/a": { put: { summary: "Put" }, get: { summary: "Get" } } } },
      "x",
    );
    expect(result.endpoints["/a"].summary).toBe("Get");
  });
});

describe("referenceDifferences", () => {
  it("finds no differences in the same reference", () => {
    expect(referenceDifferences(reference(), reference())).toEqual([]);
  });

  it("finds a new endpoint and a removed endpoint", () => {
    const published = reference();
    published.endpoints["/audio-bibles"] = { methods: ["get"], parameters: {} };
    delete published.endpoints["/bibles/{bibleId}"];
    expect(referenceDifferences(reference(), published)).toEqual([
      "/audio-bibles is a new endpoint",
      "/bibles/{bibleId} is no longer in the reference",
    ]);
  });

  it("finds a changed summary, description, path parameter and methods", () => {
    const published = reference();
    const endpoint = published.endpoints["/bibles/{bibleId}"];
    endpoint.summary = "Get one Bible";
    endpoint.description = "Other";
    endpoint.pathParameters = { bibleId: "The ID" };
    endpoint.methods = ["get", "post"];
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles/{bibleId}: the summary changed to "Get one Bible"',
      "/bibles/{bibleId}: the description changed",
      "/bibles/{bibleId}: the description of an ID in the path changed",
      "/bibles/{bibleId} changed its methods to get, post",
    ]);
  });

  it("reports a removed summary as an empty summary", () => {
    const published = reference();
    delete published.endpoints["/bibles"].summary;
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the summary changed to ""',
    ]);
  });

  it("finds path parameters that were added or removed", () => {
    const published = reference();
    delete published.endpoints["/bibles/{bibleId}"].pathParameters;
    published.endpoints["/bibles"].pathParameters = { x: "y" };
    expect(referenceDifferences(reference(), published)).toEqual([
      "/bibles: the description of an ID in the path changed",
      "/bibles/{bibleId}: the description of an ID in the path changed",
    ]);
  });

  it("finds a parameter that was added or removed", () => {
    const published = reference();
    const parameters = published.endpoints["/bibles"].parameters;
    delete parameters.language;
    parameters.abbreviation = { description: "Abbreviation" };
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles has the new parameter "abbreviation"',
      '/bibles no longer has the parameter "language"',
    ]);
  });

  it("finds a changed parameter description", () => {
    const published = reference();
    published.endpoints["/bibles"].parameters.language.description = "Language";
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the description of "language" changed',
    ]);
  });

  it("finds a changed, added or removed default", () => {
    const published = reference();
    const parameters = published.endpoints["/bibles"].parameters;
    parameters["include-full-details"].default = "true";
    parameters.language.default = "eng";
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the default of "include-full-details" changed to "true"',
      '/bibles: the default of "language" changed to "eng"',
    ]);

    const noDefault = reference();
    delete noDefault.endpoints["/bibles"].parameters["include-full-details"].default;
    expect(referenceDifferences(reference(), noDefault)).toEqual([
      '/bibles: the default of "include-full-details" changed to no default',
    ]);
  });

  it("finds changed, added or removed values", () => {
    const published = reference();
    const parameters = published.endpoints["/bibles"].parameters;
    parameters["include-full-details"].values = ["true"];
    parameters.language.values = ["eng", "spa"];
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the values of "include-full-details" changed to true',
      '/bibles: the values of "language" changed to eng, spa',
    ]);

    const anyValue = reference();
    delete anyValue.endpoints["/bibles"].parameters["include-full-details"].values;
    expect(referenceDifferences(reference(), anyValue)).toEqual([
      '/bibles: the values of "include-full-details" changed to any value',
    ]);
  });

  it("finds methods that changed but are the same in number", () => {
    const published = reference();
    published.endpoints["/bibles"].methods = ["post"];
    expect(referenceDifferences(reference(), published)).toEqual([
      "/bibles changed its methods to post",
    ]);
  });

  it("finds a value that was swapped for another value", () => {
    const published = reference();
    published.endpoints["/bibles"].parameters["include-full-details"].values = ["true", "maybe"];
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the values of "include-full-details" changed to true, maybe',
    ]);
  });

  it("reports each change of a parameter", () => {
    const published = reference();
    published.endpoints["/bibles"].parameters["include-full-details"] = {
      description: "Other",
      default: "true",
      values: ["yes"],
    };
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the description of "include-full-details" changed',
      '/bibles: the default of "include-full-details" changed to "true"',
      '/bibles: the values of "include-full-details" changed to yes',
    ]);
  });

  it("reports a changed default and changed values without a changed description", () => {
    const published = reference();
    const parameter = published.endpoints["/bibles"].parameters["include-full-details"];
    delete parameter.default;
    parameter.values = ["true"];
    expect(referenceDifferences(reference(), published)).toEqual([
      '/bibles: the default of "include-full-details" changed to no default',
      '/bibles: the values of "include-full-details" changed to true',
    ]);
  });
});

describe("pageFile and samplePath", () => {
  it("gives the page file of an endpoint", () => {
    expect(pageFile("/bibles/{bibleId}/books").replaceAll("\\", "/")).toBe(
      "app/bibles/[bibleId]/books/page.tsx",
    );
    expect(pageFile("/").replaceAll("\\", "/")).toBe("app/page.tsx");
  });

  it("puts the sample IDs in the path, and keeps the IDs that have no sample", () => {
    expect(
      samplePath("/bibles/{bibleId}/books/{bookId}", { ids: { bibleId: "de4e-01" } }),
    ).toBe("/bibles/de4e-01/books/{bookId}");
    expect(samplePath("/bibles/{bibleId}", {})).toBe("/bibles/{bibleId}");
  });

  it("puts each sample ID in a path that has more than one ID", () => {
    expect(
      samplePath("/bibles/{bibleId}/books/{bookId}", { ids: { bibleId: "de4e-01", bookId: "GEN" } }),
    ).toBe("/bibles/de4e-01/books/GEN");
  });
});

describe("hasText", () => {
  it("finds the text in double or single quotes", () => {
    expect(hasText('const a = "language";', "language")).toBe(true);
    expect(hasText("const a = 'language';", "language")).toBe(true);
  });

  it("does not find text without quotes or inside a longer string", () => {
    expect(hasText("language", "language")).toBe(false);
    expect(hasText('"languages"', "language")).toBe(false);
    expect(hasText("`language`", "language")).toBe(false);
  });
});

describe("coveredEntries", () => {
  it("leaves out the deferred entries", () => {
    expect(
      coveredEntries({ "/a": { sdk: "a.list" }, "/b": { deferred: "Later" } }),
    ).toEqual([["/a", { sdk: "a.list" }]]);
  });
});

describe("checkEndpoints", () => {
  it("passes when the reference and the manifest agree", () => {
    expect(
      checkEndpoints(reference(), {
        "/bibles": { sdk: "bibles.list" },
        "/bibles/{bibleId}": { deferred: "Not yet" },
      }),
    ).toEqual([ok("/bibles"), ok("/bibles/{bibleId} (deferred: Not yet)")]);
  });

  it("fails for a missing entry, an unknown entry and a method that is not GET", () => {
    const ref = reference();
    ref.endpoints["/bibles"].methods = ["get", "post", "put"];
    expect(
      checkEndpoints(ref, { "/bibles": { sdk: "bibles.list" }, "/gone": { sdk: "gone.list" } }),
    ).toEqual([
      failure("/bibles has the method post, put. The demo shows only GET requests."),
      failure("/bibles/{bibleId} is in the reference, but not in parity/coverage.mjs"),
      failure("/gone is in parity/coverage.mjs, but not in the reference"),
    ]);
  });

  it("fails for a deferred entry that is not in the reference", () => {
    expect(
      checkEndpoints(reference(), {
        "/bibles": { sdk: "bibles.list" },
        "/bibles/{bibleId}": { sdk: "bibles.get" },
        "/gone": { deferred: "Later" },
      }).filter((result) => !result.ok),
    ).toEqual([failure("/gone is in parity/coverage.mjs, but not in the reference")]);
  });

  it("passes a deferred entry that has a method that is not GET", () => {
    const ref = reference();
    ref.endpoints["/bibles"].methods = ["post"];
    expect(checkEndpoints(ref, { "/bibles": { deferred: "POST" } } as Coverage)[0]).toEqual(
      ok("/bibles (deferred: POST)"),
    );
  });
});

describe("checkParameters", () => {
  const params = {
    language: { sample: "eng" },
    "include-full-details": { sample: "true" },
  };

  it("passes when the parameters agree", () => {
    expect(
      checkParameters(reference(), [
        ["/bibles", { params }],
        ["/bibles/{bibleId}", {}],
      ]),
    ).toEqual([
      ok("/bibles (language, include-full-details)"),
      ok("/bibles/{bibleId} (no parameters)"),
    ]);
  });

  it("names the deferred parameters", () => {
    expect(
      checkParameters(reference(), [
        ["/bibles", { params: { ...params, language: { deferred: "Later" } } }],
      ]),
    ).toEqual([ok("/bibles (language, include-full-details) (deferred: language)")]);
  });

  it("fails for a missing parameter and an unknown parameter", () => {
    expect(
      checkParameters(reference(), [
        ["/bibles", { params: { language: { sample: "eng" }, name: { sample: "KJV" } } }],
      ]),
    ).toEqual([
      failure('/bibles: the reference has the parameter "include-full-details", but the manifest does not'),
      failure('/bibles: the manifest has the parameter "name", but the reference does not'),
    ]);
  });

  it("fails for an unknown parameter when no parameter is missing", () => {
    const results = checkParameters(reference(), [
      ["/bibles", { params: { ...params, name: { sample: "KJV" } } }],
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].message).toContain('"name"');
  });

  it("fails for a missing parameter when no parameter is unknown, and gives no pass", () => {
    expect(
      checkParameters(reference(), [["/bibles", { params: { language: { sample: "eng" } } }]]),
    ).toEqual([
      failure('/bibles: the reference has the parameter "include-full-details", but the manifest does not'),
    ]);
  });

  it("fails when the reference has no help text", () => {
    const ref = reference();
    const endpoint = ref.endpoints["/bibles"];
    delete endpoint.summary;
    delete endpoint.description;
    delete endpoint.parameters.language.description;
    expect(checkParameters(ref, [["/bibles", { params }]])).toEqual([
      failure("/bibles: the reference has no summary, so the demo has no help text for it"),
      failure("/bibles: the reference has no description, so the demo has no help text for it"),
      failure(
        '/bibles: the reference has no description for the parameter "language", so the demo has no help text for it',
      ),
    ]);
  });

  it("skips an entry that is not in the reference", () => {
    expect(checkParameters(reference(), [["/gone", { params }]])).toEqual([]);
  });

  //The live check cannot set a parameter without a sample, so the manifest must give one
  it("fails for a parameter that has no sample and is not deferred", () => {
    expect(
      checkParameters(reference(), [
        ["/bibles", { params: { ...params, language: {} } }],
      ]),
    ).toEqual([failure('/bibles: the parameter "language" has no sample')]);
    expect(
      checkParameters(reference(), [
        ["/bibles", { params: { ...params, language: { expect: "eng" } } }],
      ]),
    ).toEqual([failure('/bibles: the parameter "language" has no sample')]);
  });});

describe("checkSource", () => {
  const pages: Record<string, string> = {
    "app/bibles/page.tsx": `
      const bibles = await client.bibles.list({ language, "include-full-details": full });
      const options = ["true", 'false'];
    `,
    "app/bibles/[bibleId]/page.tsx": "await client\n  .bibles\n  .get(bibleId);",
  };
  const readPage = (file: string) => pages[file.replaceAll("\\", "/")];
  const params = {
    language: { sample: "eng" },
    "include-full-details": { sample: "true" },
  };

  it("passes when the page calls the SDK and has the parameters and values", () => {
    expect(
      checkSource(
        reference(),
        [
          ["/bibles", { sdk: "bibles.list", params }],
          ["/bibles/{bibleId}", { sdk: "bibles.get" }],
        ],
        readPage,
        'export const name = "language";',
      ),
    ).toEqual([
      ok("/bibles → app/bibles/page.tsx"),
      ok("/bibles/{bibleId} → app/bibles/[bibleId]/page.tsx"),
    ]);
  });

  it("fails when the page does not exist", () => {
    expect(
      checkSource(reference(), [["/bibles/{bibleId}/books", { sdk: "books.list" }]], readPage, ""),
    ).toEqual([failure("/bibles/{bibleId}/books: the demo has no page at app/bibles/[bibleId]/books/page.tsx")]);
  });

  it("fails without an sdk method, or when the page calls another method", () => {
    expect(
      checkSource(
        reference(),
        [
          ["/bibles/{bibleId}", {}],
          ["/bibles/{bibleId}", { sdk: "bibles.list" }],
        ],
        readPage,
        "",
      ),
    ).toEqual([
      failure('/bibles/{bibleId}: the manifest has no "sdk" method'),
      failure("/bibles/{bibleId}: the page does not call client.bibles.list()"),
    ]);
  });

  it("fails for a parameter or a value that is not in the source", () => {
    const ref = reference();
    ref.endpoints["/bibles"].parameters["include-full-details"].values = ["true", "maybe"];
    expect(
      checkSource(
        ref,
        [["/bibles", { sdk: "bibles.list", params: { ...params, abbreviation: { sample: "KJV" } } }]],
        readPage,
        "",
      ),
    ).toEqual([
      failure('/bibles: the source does not contain the parameter "language"'),
      failure('/bibles: the source does not contain the value "maybe" of "include-full-details"'),
      failure('/bibles: the source does not contain the parameter "abbreviation"'),
    ]);
  });

  it("finds values in the shared source, and skips parameters with another name on the page", () => {
    const ref = reference();
    ref.endpoints["/bibles"].parameters.language.values = ["eng"];
    expect(
      checkSource(
        ref,
        [
          [
            "/bibles",
            { sdk: "bibles.list", params: { language: { sample: "eng", page: "lang" } } },
          ],
        ],
        readPage,
        "const values = ['eng'];",
      ),
    ).toEqual([ok("/bibles → app/bibles/page.tsx")]);
  });

  it("skips a deferred parameter that is not in the page or the shared source", () => {
    const ref = reference();
    ref.endpoints["/bibles"].parameters.hidden = { values: ["nowhere"] };
    expect(
      checkSource(
        ref,
        [["/bibles", { sdk: "bibles.list", params: { hidden: { deferred: "Later" } } }]],
        readPage,
        "",
      ),
    ).toEqual([ok("/bibles → app/bibles/page.tsx")]);
  });

  it("fails when the page calls a longer method name, or a client that is not `client`", () => {
    const sdkPages: Record<string, string> = {
      "app/bibles/page.tsx": "await client.bibles.listing();",
      "app/bibles/[bibleId]/page.tsx": "await foo.bibles.get(bibleId);",
    };
    const results = checkSource(
      reference(),
      [
        ["/bibles", { sdk: "bibles.list" }],
        ["/bibles/{bibleId}", { sdk: "bibles.get" }],
      ],
      (file) => sdkPages[file.replaceAll("\\", "/")],
      "",
    );
    expect(results.map((result) => result.ok)).toEqual([false, false]);
    expect(results[0].message).toContain("client.bibles.list()");
    expect(results[1].message).toContain("client.bibles.get()");
  });
});

describe("decodeHtml", () => {
  it("decodes the entities that React writes", () => {
    expect(decodeHtml("a &amp; b &quot;c&quot; &#x27;d&#x27; &lt;e&gt;")).toBe(
      "a & b \"c\" 'd' <e>",
    );
  });

  it("keeps other entities", () => {
    expect(decodeHtml("&nbsp;&#39;&apos;")).toBe("&nbsp;&#39;&apos;");
  });

  it("decodes an escaped entity once", () => {
    //`&amp;lt;` is the text `&lt;`. It must not become `<`.
    expect(decodeHtml("&amp;lt;")).toBe("&lt;");
    expect(decodeHtml("&amp;gt;")).toBe("&gt;");
    expect(decodeHtml("&amp;quot;")).toBe("&quot;");
    expect(decodeHtml("&amp;#x27;")).toBe("&#x27;");
    expect(decodeHtml("&amp;amp;")).toBe("&amp;");
  });

  it("decodes each plain entity on its own", () => {
    expect(decodeHtml("&quot;")).toBe('"');
    expect(decodeHtml("&#x27;")).toBe("'");
    expect(decodeHtml("&lt;")).toBe("<");
    expect(decodeHtml("&gt;")).toBe(">");
    expect(decodeHtml("&amp;")).toBe("&");
  });
});

describe("decodeMarkdown", () => {
  it("keeps the text of a link and removes the marks", () => {
    expect(decodeMarkdown("See [the *docs*](https://docs.test/a_b) for `code` and \\_x_")).toBe(
      "See the docs for code and x",
    );
  });

  it("keeps a link with a space in the address", () => {
    expect(decodeMarkdown("[a](b c)")).toBe("[a](b c)");
  });

  it("keeps text without marks", () => {
    expect(decodeMarkdown("Plain text.")).toBe("Plain text.");
  });
});

describe("plainText", () => {
  it("decodes entities and removes marks and spaces", () => {
    expect(plainText(" A &amp; *B*\n\t_c_ `d` \\ ")).toBe("A&Bcd");
  });
});

describe("pageRequest", () => {
  it("gives the page path with the samples, the page names and no deferred parameters", () => {
    expect(
      pageRequest("/bibles/{bibleId}/search", {
        ids: { bibleId: "kjv" },
        params: {
          query: { sample: "love one another" },
          offset: { sample: "10", page: "page", expect: "10" },
          fuzziness: { deferred: "Later" },
        },
      }),
    ).toEqual({
      params: [
        { name: "query", sample: "love one another" },
        { name: "offset", sample: "10", page: "page", expect: "10" },
      ],
      route: "/bibles/kjv/search",
      pagePath: "/bibles/kjv/search?query=love+one+another&page=10",
    });
  });

  it("does not put a parameter without a sample in the page path", () => {
    expect(
      pageRequest("/bibles", {
        params: { language: { sample: "eng" }, name: {} },
      }),
    ).toEqual({
      params: [{ name: "language", sample: "eng" }, { name: "name" }],
      route: "/bibles",
      pagePath: "/bibles?language=eng",
    });
    expect(pageRequest("/bibles", { params: { name: {} } }).pagePath).toBe("/bibles");
  });

  it("gives no query when there are no parameters", () => {
    expect(pageRequest("/bibles/{bibleId}", { ids: { bibleId: "kjv" } }).pagePath).toBe(
      "/bibles/kjv",
    );
  });
});

describe("checkPageHtml", () => {
  const entry = {
    params: {
      language: { sample: "eng" },
      "include-full-details": { sample: "false" },
    },
  };
  //A page that is in parity: the default "false" is not sent
  const html = ({
    request = "https://rest.api.bible/v1/bibles?language=eng",
    status = "200",
    body = "<h1>Get Bibles</h1><p>Gets a list of Bibles.</p><p>ISO 639-3 language code</p><p>Include full details</p>",
  } = {}) =>
    `<html><body><div data-api-request="${request}" data-api-status="${status}"></div>${body}` +
    `<script>const text = "nothing here";</script></body></html>`;

  it("passes a page that agrees with the manifest and the reference", () => {
    expect(checkPageHtml(reference(), "/bibles", entry, html())).toEqual([
      ok("/bibles → /v1/bibles?language=eng"),
    ]);
  });

  it("decodes the entities in the request URL", () => {
    const ref = reference();
    ref.endpoints["/bibles"].parameters["include-full-details"].default = "true";
    expect(
      checkPageHtml(
        ref,
        "/bibles",
        entry,
        html({
          request:
            "https://rest.api.bible/v1/bibles?language=eng&amp;include-full-details=false",
        }),
      ),
    ).toEqual([ok("/bibles → /v1/bibles?language=eng&include-full-details=false")]);
  });

  it("fails when the page has no API status", () => {
    const page = html().replace(' data-api-status="200"', "");
    expect(page).not.toContain("data-api-status");
    const results = checkPageHtml(reference(), "/bibles", entry, page);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].message).toContain("the API gave the status");
  });

  it("fails for a request path that only starts with the path of the endpoint", () => {
    const results = checkPageHtml(
      reference(),
      "/bibles/{bibleId}",
      { ids: { bibleId: "kjv" } },
      html({
        request: "https://rest.api.bible/v1/bibles/kjv/extra",
        body: "<h1>Get a Bible</h1><p>Gets one Bible.</p>",
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].message).toContain("/v1/bibles/kjv/extra");
  });

  it("compares the request with the expected value, not the sample, for the default", () => {
    const ref = reference();
    const body = "<p>Get Bibles</p><p>Gets a list of Bibles.</p><p>ISO 639-3 language code</p><p>Include full details</p>";
    //The sample is not the default, but the expected value is: the demo must not send it
    const expectDefault = {
      params: { language: { sample: "eng" }, "include-full-details": { sample: "true", expect: "false" } },
    };
    expect(
      checkPageHtml(ref, "/bibles", expectDefault, html({ body })).map((r) => r.ok),
    ).toEqual([true]);
    expect(
      checkPageHtml(
        ref,
        "/bibles",
        expectDefault,
        html({ body, request: "https://rest.api.bible/v1/bibles?language=eng&include-full-details=false" }),
      ).map((r) => r.ok),
    ).toEqual([false]);
    //The sample is the default, but the expected value is not: the demo must send it
    const expectOther = {
      params: { language: { sample: "eng" }, "include-full-details": { sample: "false", expect: "true" } },
    };
    expect(
      checkPageHtml(
        ref,
        "/bibles",
        expectOther,
        html({ body, request: "https://rest.api.bible/v1/bibles?language=eng&include-full-details=true" }),
      ).map((r) => r.ok),
    ).toEqual([true]);
    expect(
      checkPageHtml(ref, "/bibles", expectOther, html({ body })).map((r) => r.ok),
    ).toEqual([false]);
  });

  it("finds the help text when the page has markup inside a sentence", () => {
    const ref = reference();
    ref.endpoints["/bibles/{bibleId}"].summary = "Gets a list of items";
    expect(
      checkPageHtml(
        ref,
        "/bibles/{bibleId}",
        { ids: { bibleId: "kjv" } },
        html({
          request: "https://rest.api.bible/v1/bibles/kjv",
          body: "<h1>Gets a <code>list</code> of items</h1><p>Gets one Bible.</p>",
        }),
      ),
    ).toEqual([ok("/bibles/{bibleId} → /v1/bibles/kjv")]);
  });

  //The page can cut a long text, so only the first 80 characters (without spaces) must agree
  it("compares the first 80 characters of the help text, and no more", () => {
    const ref = reference();
    const start = "a".repeat(79);
    ref.endpoints["/bibles/{bibleId}"].summary = `${start}bone`;
    const check = (summary: string) =>
      checkPageHtml(
        ref,
        "/bibles/{bibleId}",
        { ids: { bibleId: "kjv" } },
        html({
          request: "https://rest.api.bible/v1/bibles/kjv",
          body: `<h1>${summary}</h1><p>Gets one Bible.</p>`,
        }),
      );
    //A difference in the 80th character fails
    expect(check(`${start}cone`)).toEqual([
      failure(`/bibles/{bibleId}: the page does not show the summary of the reference ("${start}bone")`),
    ]);
    //A difference after the 80th character passes
    expect(check(`${start}btwo`)).toEqual([ok("/bibles/{bibleId} → /v1/bibles/kjv")]);
  });

  it("fails for each parameter whose description the page does not show", () => {
    //The page shows the summary, the description and the text of "language", but not of "include-full-details"
    const body = "<h1>Get Bibles</h1><p>Gets a list of Bibles.</p><p>ISO 639-3 language code</p>";
    expect(checkPageHtml(reference(), "/bibles", entry, html({ body }))).toEqual([
      failure('/bibles: the page does not show the description of "include-full-details" from the reference'),
    ]);
  });

  it("fails for a request path in another version of the API", () => {
    for (const request of ["https://rest.api.bible/v2/bibles/kjv", "https://rest.api.bible/x/bibles/kjv"]) {
      const pathname = new URL(request).pathname;
      expect(
        checkPageHtml(
          reference(),
          "/bibles/{bibleId}",
          { ids: { bibleId: "kjv" } },
          html({ request, body: "<h1>Get a Bible</h1><p>Gets one Bible.</p>" }),
        ),
      ).toEqual([failure(`/bibles/{bibleId}: the API path is ${pathname}, not /v1/bibles/kjv`)]);
    }
  });

  it.each(["201", "204", "299"])("fails for the status %s, which is a success but not 200", (status) => {
    expect(checkPageHtml(reference(), "/bibles", entry, html({ status }))).toEqual([
      failure(`/bibles: the API gave the status ${status}`),
    ]);
  });

  it("fails when the page shows no API request", () => {
    expect(checkPageHtml(reference(), "/bibles", entry, "<html></html>")).toEqual([
      failure(
        "/bibles: /bibles?language=eng&include-full-details=false does not show an API request. The page or the API call failed.",
      ),
    ]);
  });

  it("fails for a status that is not 200, and a path that does not match", () => {
    expect(
      checkPageHtml(
        reference(),
        "/bibles/{bibleId}",
        { ids: { bibleId: "kjv" } },
        html({
          request: "https://rest.api.bible/v1/bibles/web",
          status: "404",
          body: "<h1>Get a Bible</h1><p>Gets one Bible.</p>",
        }),
      ),
    ).toEqual([
      failure("/bibles/{bibleId}: the API gave the status 404"),
      failure("/bibles/{bibleId}: the API path is /v1/bibles/web, not /v1/bibles/kjv"),
    ]);
  });

  it("fails when the request does not match the controls", () => {
    expect(
      checkPageHtml(
        reference(),
        "/bibles",
        entry,
        html({
          request:
            "https://rest.api.bible/v1/bibles?language=spa&include-full-details=false&name=x",
        }),
      ),
    ).toEqual([
      failure('/bibles: "language" is "spa" in the API request, not "eng"'),
      failure(
        '/bibles: "include-full-details" is "false" in the API request, but it is the default of the API and must be absent',
      ),
      failure('/bibles: the API request has "name", which is not in the manifest'),
    ]);
  });

  it("fails for a parameter that is absent, and uses the expected value", () => {
    expect(
      checkPageHtml(
        reference(),
        "/bibles",
        { params: { ...entry.params, language: { sample: "English", expect: "eng" } } },
        html({ request: "https://rest.api.bible/v1/bibles" }),
      ),
    ).toEqual([failure('/bibles: "language" is absent in the API request, not "eng"')]);
  });

  //The static check reports a parameter without a sample. The page check cannot set it, so
  //it does not compare its value, and does not load the page with "undefined" as the value.
  it("does not check the value of a parameter without a sample", () => {
    const noSample = { params: { ...entry.params, language: {} } };
    expect(checkPageHtml(reference(), "/bibles", noSample, "<html></html>")).toEqual([
      failure(
        "/bibles: /bibles?include-full-details=false does not show an API request. The page or the API call failed.",
      ),
    ]);
    expect(
      checkPageHtml(reference(), "/bibles", noSample, html({ request: "https://rest.api.bible/v1/bibles" })),
    ).toEqual([ok("/bibles → /v1/bibles")]);
    expect(checkPageHtml(reference(), "/bibles", noSample, html())).toEqual([
      ok("/bibles → /v1/bibles?language=eng"),
    ]);
  });

  it("fails when the response has a FUMS token but the page does not load the script", () => {
    const body = "<h1>Get Bibles</h1><p>Gets a list of Bibles.</p><p>ISO 639-3 language code</p><p>Include full details</p>";
    expect(
      checkPageHtml(reference(), "/bibles", entry, html({ body: body + "<pre>fumsToken</pre>" })),
    ).toEqual([
      failure("/bibles: the response has a FUMS token, but the page does not load the FUMS script"),
    ]);
    expect(
      checkPageHtml(
        reference(),
        "/bibles",
        entry,
        html({ body: body + '<pre>fumsToken</pre><script src="https://x/fumsV3.min.js"></script>' }),
      ),
    ).toEqual([ok("/bibles → /v1/bibles?language=eng")]);
  });

  it("fails when the page does not show the text of the reference", () => {
    expect(
      checkPageHtml(reference(), "/bibles", entry, html({ body: "<h1>Bibles</h1>" })),
    ).toEqual([
      failure('/bibles: the page does not show the summary of the reference ("Get Bibles")'),
      failure("/bibles: the page does not show the description of the reference"),
      failure('/bibles: the page does not show the description of "language" from the reference'),
      failure(
        '/bibles: the page does not show the description of "include-full-details" from the reference',
      ),
    ]);
  });

  it("does not read the text in scripts", () => {
    const result = checkPageHtml(
      reference(),
      "/bibles/{bibleId}",
      { ids: { bibleId: "kjv" } },
      html({
        request: "https://rest.api.bible/v1/bibles/kjv",
        body: "<script>Get a Bible. Gets one Bible.</script>",
      }),
    );
    expect(result.map((r) => r.message)).toEqual([
      '/bibles/{bibleId}: the page does not show the summary of the reference ("Get a Bible")',
      "/bibles/{bibleId}: the page does not show the description of the reference",
    ]);
  });

  it("compares only the first paragraph and the first 80 characters, with entities and Markdown", () => {
    const ref = reference();
    const endpoint = ref.endpoints["/bibles/{bibleId}"];
    endpoint.summary = "Get a [Bible](https://x.test) & **more**";
    endpoint.description = `${"Long text ".repeat(10)}that the page cuts.\n\nSecond paragraph.`;
    expect(
      checkPageHtml(
        ref,
        "/bibles/{bibleId}",
        { ids: { bibleId: "kjv" } },
        html({
          request: "https://rest.api.bible/v1/bibles/kjv",
          //The first 80 characters without spaces are the 10 repeats, so the rest is not necessary
          body: `<h1>Get a Bible &amp; more</h1><p>${"Long text ".repeat(10)}</p>`,
        }),
      ),
    ).toEqual([ok("/bibles/{bibleId} → /v1/bibles/kjv")]);
  });

  it("checks a page with no summary, description or parameter text", () => {
    const ref = reference();
    const endpoint = ref.endpoints["/bibles"];
    delete endpoint.summary;
    delete endpoint.description;
    endpoint.parameters = {};
    expect(
      checkPageHtml(ref, "/bibles", { params: { language: { sample: "eng" } } }, html({ body: "" })),
    ).toEqual([ok("/bibles → /v1/bibles?language=eng")]);
  });
});
