import { describe, expect, it } from "vitest";
import {
  USE_ORG_ID,
  contentOptions,
  contentParams,
  flagParam,
  orgIdQuery,
  paramFlag,
  paramList,
  paramText,
  paramValue,
  readParams,
  textParam,
  toQueryString,
} from "@/utils/queryParams";

const content = (
  searchParams: Record<string, string | string[] | undefined> = {},
  defaults: Record<string, string> = {},
) => readParams(contentParams(defaults), searchParams);

describe("flagParam and textParam", () => {
  it("makes a true/false parameter", () => {
    expect(flagParam("include-notes", "false")).toEqual({
      name: "include-notes",
      options: ["true", "false"],
      defaultValue: "false",
    });
  });

  it("makes a typed parameter with an empty default", () => {
    expect(textParam("query", "love")).toEqual({
      name: "query",
      options: [],
      defaultValue: "",
      placeholder: "love",
    });
  });

  it("makes a typed parameter with a default", () => {
    expect(textParam("limit", "10", "10").defaultValue).toBe("10");
  });
});

describe("contentParams", () => {
  it("lists the content parameters with the API defaults, parallels last", () => {
    const params = contentParams();
    expect(params.map((param) => param.name)).toEqual([
      "content-type",
      "include-notes",
      "include-titles",
      "include-chapter-numbers",
      "include-verse-numbers",
      "include-verse-spans",
      "parallels",
    ]);
    expect(params.find((p) => p.name === "include-titles")?.defaultValue).toBe(
      "true",
    );
    expect(params.at(-1)?.kind).toBe("bibles");
  });

  it("overrides the defaults of a page", () => {
    const params = contentParams({ "content-type": "text" });
    expect(params[0].defaultValue).toBe("text");
    expect(params[1].defaultValue).toBe("false");
  });

  it("puts extra parameters before parallels", () => {
    const names = contentParams({}, [USE_ORG_ID]).map((param) => param.name);
    expect(names.slice(-2)).toEqual(["use-org-id", "parallels"]);
  });

  it("applies page defaults to extra parameters too", () => {
    const params = contentParams({ "use-org-id": "true" }, [USE_ORG_ID]);
    expect(params.find((p) => p.name === "use-org-id")?.defaultValue).toBe(
      "true",
    );
  });
});

describe("readParams", () => {
  it("uses the defaults when the URL gives nothing", () => {
    const params = content();
    expect(paramValue(params, "content-type")).toBe("html");
    expect(paramFlag(params, "include-titles")).toBe(true);
    expect(paramFlag(params, "include-notes")).toBe(false);
  });

  it("reads a permitted value", () => {
    const params = content({ "content-type": "json", "include-notes": "true" });
    expect(paramValue(params, "content-type")).toBe("json");
    expect(paramFlag(params, "include-notes")).toBe(true);
  });

  it("falls back to the default for a value that is not permitted", () => {
    const params = content({ "content-type": "pdf", "include-notes": "yes" });
    expect(paramValue(params, "content-type")).toBe("html");
    expect(paramFlag(params, "include-notes")).toBe(false);
  });

  it("uses the first item of an array value", () => {
    const params = content({ "content-type": ["text", "json"] });
    expect(paramValue(params, "content-type")).toBe("text");
  });

  it("falls back to the default when the first array item is not permitted", () => {
    const params = content({ "content-type": ["pdf", "text"] });
    expect(paramValue(params, "content-type")).toBe("html");
  });

  it("falls back to the default for an empty array", () => {
    const params = content({ "content-type": [] });
    expect(paramValue(params, "content-type")).toBe("html");
  });

  it("treats an undefined value as absent", () => {
    const params = content({ "content-type": undefined });
    expect(paramValue(params, "content-type")).toBe("html");
  });

  it("is case sensitive for permitted values", () => {
    const params = content({ "content-type": "TEXT" });
    expect(paramValue(params, "content-type")).toBe("html");
  });

  it("keeps the definition fields and adds the value", () => {
    const [param] = readParams([textParam("query", "love")], { query: "x" });
    expect(param).toEqual({
      name: "query",
      options: [],
      defaultValue: "",
      placeholder: "love",
      value: "x",
    });
  });

  it("trims a typed value", () => {
    const [param] = readParams([textParam("query", "love")], {
      query: "  grace  ",
    });
    expect(param.value).toBe("grace");
  });

  it("uses the default of a typed parameter when absent", () => {
    const [param] = readParams([textParam("limit", "10", "10")], {});
    expect(param.value).toBe("10");
  });

  it("limits a typed value to 500 characters", () => {
    const [param] = readParams([textParam("query", "x")], {
      query: "a".repeat(800),
    });
    expect(param.value).toHaveLength(500);
  });

  it("uses the first item of an array for a typed value", () => {
    const [param] = readParams([textParam("query", "x")], {
      query: ["one", "two"],
    });
    expect(param.value).toBe("one");
  });

  it("uses the default for an empty array of a typed value", () => {
    const [param] = readParams([textParam("query", "x", "dflt")], {
      query: [],
    });
    expect(param.value).toBe("dflt");
  });

  it("allows an empty typed value to replace a default", () => {
    const [param] = readParams([textParam("limit", "10", "10")], {
      limit: "",
    });
    expect(param.value).toBe("");
  });

  it("returns nothing for no definitions", () => {
    expect(readParams([], { a: "b" })).toEqual([]);
  });
});

describe("param helpers", () => {
  const params = readParams(
    [
      textParam("query", "x"),
      textParam("range", "x"),
      textParam("ids", "x"),
      flagParam("flag", "false"),
    ],
    { query: "love", ids: " a, b ,, c ,", flag: "true" },
  );

  it("paramValue returns an empty string for an unknown name", () => {
    expect(paramValue(params, "missing")).toBe("");
    expect(paramValue(params, "query")).toBe("love");
  });

  it("paramFlag is true only for the text true", () => {
    expect(paramFlag(params, "flag")).toBe(true);
    expect(paramFlag(params, "query")).toBe(false);
    expect(paramFlag(params, "missing")).toBe(false);
  });

  it("paramText returns undefined when empty or unknown", () => {
    expect(paramText(params, "query")).toBe("love");
    expect(paramText(params, "range")).toBeUndefined();
    expect(paramText(params, "missing")).toBeUndefined();
  });

  it("paramList splits on commas, trims and drops empty items", () => {
    expect(paramList(params, "ids")).toEqual(["a", "b", "c"]);
  });

  it("paramList returns undefined when empty, only commas, or unknown", () => {
    expect(paramList(params, "range")).toBeUndefined();
    expect(paramList(params, "missing")).toBeUndefined();
    const commas = readParams([textParam("ids", "x")], { ids: " , , " });
    expect(paramList(commas, "ids")).toBeUndefined();
  });
});

describe("orgIdQuery", () => {
  it("is empty when use-org-id is off or absent", () => {
    expect(orgIdQuery(readParams([USE_ORG_ID], {}))).toEqual({});
    expect(orgIdQuery([])).toEqual({});
  });

  it("gives use-org-id when it is true", () => {
    expect(orgIdQuery(readParams([USE_ORG_ID], { "use-org-id": "true" }))).toEqual(
      { "use-org-id": "true" },
    );
  });
});

describe("contentOptions", () => {
  it("converts the defaults to SDK options", () => {
    expect(contentOptions(content())).toEqual({
      contentType: "html",
      includeNotes: false,
      includeTitles: true,
      includeChapterNumbers: false,
      includeVerseNumbers: true,
      includeVerseSpans: false,
      parallels: undefined,
    });
  });

  it("converts changed values and the parallels list", () => {
    const params = readParams(contentParams(), {
      "content-type": "text",
      "include-notes": "true",
      "include-titles": "false",
      "include-chapter-numbers": "true",
      "include-verse-numbers": "false",
      "include-verse-spans": "true",
      parallels: "a-01, b-01",
    });
    expect(contentOptions(params)).toEqual({
      contentType: "text",
      includeNotes: true,
      includeTitles: false,
      includeChapterNumbers: true,
      includeVerseNumbers: false,
      includeVerseSpans: true,
      parallels: ["a-01", "b-01"],
    });
  });
});

describe("toQueryString", () => {
  it("returns an empty string when all values are defaults", () => {
    expect(toQueryString(content())).toBe("");
  });

  it("includes only values that differ from the defaults", () => {
    const params = content({ "content-type": "json", "include-titles": "true" });
    expect(toQueryString(params)).toBe("?content-type=json");
  });

  it("compares against the defaults of the page", () => {
    const params = content({ "content-type": "text" }, { "content-type": "text" });
    expect(toQueryString(params)).toBe("");
  });

  it("puts the extra values first and keeps them", () => {
    const params = content({ "include-notes": "true" });
    expect(toQueryString(params, { page: "2" })).toBe(
      "?page=2&include-notes=true",
    );
  });

  it("returns only the extra values when nothing differs", () => {
    expect(toQueryString(content(), { page: "2" })).toBe("?page=2");
  });

  it("lets a changed parameter replace an extra value of the same name", () => {
    const params = readParams([textParam("query", "x")], { query: "a" });
    expect(toQueryString(params, { query: "b" })).toBe("?query=a");
  });

  it("encodes special characters", () => {
    const params = readParams([textParam("query", "x")], { query: "a b&c" });
    expect(toQueryString(params)).toBe("?query=a+b%26c");
  });
});
