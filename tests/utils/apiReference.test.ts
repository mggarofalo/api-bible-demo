import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findEndpoint,
  getEndpoint,
  resourceDefinition,
} from "@/utils/apiReference";

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

  it("does not accept a path with real IDs", () => {
    expect(getEndpoint("/bibles/abc-01/search")).toBeUndefined();
  });
});

describe("resourceDefinition", () => {
  it("returns a definition for each known word", () => {
    for (const word of [
      "bibles",
      "books",
      "chapters",
      "verses",
      "passages",
      "sections",
      "search",
    ]) {
      const definition = resourceDefinition(word);
      expect(definition, word).toBeTruthy();
      expect(definition).not.toMatch(/\s{2,}|\n/);
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
