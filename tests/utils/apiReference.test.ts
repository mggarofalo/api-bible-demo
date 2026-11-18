import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findEndpoint,
  getEndpoint,
  resourceDefinition,
} from "@/utils/apiReference";
import reference from "@/parity/api-reference.json";

const endpoints = reference.endpoints as Record<
  string,
  { description?: string }
>;
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
//The endpoint that defines each word of a route
const DEFINING: Record<string, string> = {
  bibles: "/bibles/{bibleId}",
  books: "/bibles/{bibleId}/books/{bookId}",
  chapters: "/bibles/{bibleId}/chapters/{chapterId}",
  verses: "/bibles/{bibleId}/verses/{verseId}",
  passages: "/bibles/{bibleId}/passages/{passageId}",
  sections: "/bibles/{bibleId}/sections/{sectionId}",
  search: "/bibles/{bibleId}/search",
};

describe("findEndpoint", () => {
  it("finds an endpoint with no placeholders", () => {
    expect(findEndpoint("/bibles")?.path).toBe("/bibles");
  });

  it("matches a path with IDs to the path with placeholders", () => {
    expect(findEndpoint("/bibles/abc-01/books/GEN")?.path).toBe(
      "/bibles/{bibleId}/books/{bookId}",
    );
  });

  it("accepts an optional version prefix", () => {
    expect(findEndpoint("/v1/bibles/abc-01/books")?.path).toBe(
      "/bibles/{bibleId}/books",
    );
    expect(findEndpoint("/v12/bibles")?.path).toBe("/bibles");
  });

  it("does not match a placeholder across a slash", () => {
    expect(findEndpoint("/bibles/a/b/books")).toBeUndefined();
  });

  it("does not match an empty ID", () => {
    expect(findEndpoint("/bibles//books")).toBeUndefined();
  });

  it("returns undefined for unknown paths", () => {
    expect(findEndpoint("/nope")).toBeUndefined();
    expect(findEndpoint("/bibles/x/unknown")).toBeUndefined();
    expect(findEndpoint("")).toBeUndefined();
  });

  it("does not match a trailing slash", () => {
    expect(findEndpoint("/bibles/")).toBeUndefined();
  });
});

describe("getEndpoint", () => {
  it("gets an endpoint by its path with placeholders", () => {
    const endpoint = getEndpoint("/bibles/{bibleId}/search");
    expect(endpoint?.methods).toContain("get");
    expect(endpoint?.parameters.limit?.default).toBe("10");
  });

  it("returns the endpoint of exactly that path", () => {
    for (const path of Object.keys(endpoints)) {
      expect(getEndpoint(path), path).toBe(endpoints[path]);
    }
  });

  it("does not match a part of a path or a longer path", () => {
    expect(getEndpoint("/bibles/{bibleId}/boo")).toBeUndefined();
    expect(getEndpoint("/bible")).toBeUndefined();
    expect(
      getEndpoint("/bibles/{bibleId}/books/{bookId}/chapters/extra"),
    ).toBeUndefined();
  });

  it("does not return a shorter endpoint for a longer path", () => {
    expect(getEndpoint("/bibles/{bibleId}/search/extra")).toBeUndefined();
  });

  it("does not accept a path with real IDs", () => {
    expect(getEndpoint("/bibles/abc-01/search")).toBeUndefined();
  });
});

describe("resourceDefinition", () => {
  it("returns the text of the right endpoint for each word", () => {
    for (const [word, path] of Object.entries(DEFINING)) {
      const definition = resourceDefinition(word);
      expect(definition, word).toBeTruthy();
      expect(definition).not.toMatch(/\s{2,}|\n/);
      //It is text of the endpoint that defines the word...
      expect(normalize(endpoints[path].description ?? ""), word).toContain(
        definition,
      );
      //...and not text of any of the other defining endpoints
      for (const [otherWord, otherPath] of Object.entries(DEFINING)) {
        if (otherWord === word) continue;
        expect(
          normalize(endpoints[otherPath].description ?? ""),
          `${word} in ${otherWord}`,
        ).not.toContain(definition);
      }
    }
  });

  it("returns undefined for an unknown word", () => {
    expect(resourceDefinition("nothing")).toBeUndefined();
  });
});

describe("resourceDefinition with a custom reference", () => {
  afterEach(() => {
    vi.doUnmock("@/parity/api-reference.json");
    vi.resetModules();
  });

  const load = async (description?: string) => {
    vi.resetModules();
    vi.doMock("@/parity/api-reference.json", () => ({
      default: {
        endpoints: {
          "/bibles/{bibleId}/verses/{verseId}": {
            methods: ["get"],
            parameters: {},
            description,
          },
        },
      },
    }));
    return import("@/utils/apiReference");
  };

  it("takes the paragraph with 'object represents' and drops a table intro", async () => {
    const { resourceDefinition } = await load(
      "First paragraph.\n\nThe Verse object represents a verse.\n  It has an ID. A few examples are:\n\n| a | b |",
    );
    expect(resourceDefinition("verses")).toBe(
      "The Verse object represents a verse. It has an ID.",
    );
  });

  it("takes the paragraph with 'object represents', not another with 'object'", async () => {
    const { resourceDefinition } = await load(
      "An object is first.\n\nThis object has a second paragraph.\n\nThe Verse object represents a verse.\n\nLast object paragraph.",
    );
    expect(resourceDefinition("verses")).toBe(
      "The Verse object represents a verse.",
    );
  });

  it("falls back to the first paragraph", async () => {
    const { resourceDefinition } = await load(
      "| table |\n\nPlain first one.\n\nSecond one.",
    );
    expect(resourceDefinition("verses")).toBe("Plain first one.");
  });

  it("returns undefined when the endpoint has no description", async () => {
    const { resourceDefinition } = await load(undefined);
    expect(resourceDefinition("verses")).toBeUndefined();
  });

  it("returns undefined when the description has only table lines", async () => {
    const { resourceDefinition } = await load("| a |\n\n| b |");
    expect(resourceDefinition("verses")).toBeUndefined();
  });
});
