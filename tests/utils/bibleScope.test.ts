import { describe, expect, it } from "vitest";
import {
  BIBLE_SCOPE_COOKIE,
  SELECTED_BIBLE_IDS,
  parseBibleScope,
} from "@/utils/bibleScope";

describe("parseBibleScope", () => {
  it("returns all for the value all", () => {
    expect(parseBibleScope("all")).toBe("all");
  });

  it("returns selected for the value selected", () => {
    expect(parseBibleScope("selected")).toBe("selected");
  });

  it("defaults to selected when the value is missing", () => {
    expect(parseBibleScope(undefined)).toBe("selected");
    expect(parseBibleScope("")).toBe("selected");
  });

  it("defaults to selected for unknown or differently cased values", () => {
    expect(parseBibleScope("ALL")).toBe("selected");
    expect(parseBibleScope("everything")).toBe("selected");
  });
});

describe("bible scope constants", () => {
  it("names the cookie", () => {
    expect(BIBLE_SCOPE_COOKIE).toBe("bible-scope");
  });

  it("lists the IDs of the demo Bibles in order", () => {
    //The full list is pinned in demoBibles.test.ts, so check the ends here
    expect(SELECTED_BIBLE_IDS).toHaveLength(11);
    expect(SELECTED_BIBLE_IDS[0]).toBe("de4e12af7f28f599-01");
    expect(SELECTED_BIBLE_IDS[4]).toBe("bba9f40183526463-01");
    expect(SELECTED_BIBLE_IDS.at(-1)).toBe("40072c4a5aba4022-01");
  });
});
