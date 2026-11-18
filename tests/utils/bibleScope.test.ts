import { describe, expect, it } from "vitest";
import {
  BIBLE_SCOPE_COOKIE,
  SELECTED_BIBLE_IDS,
  parseBibleScope,
} from "@/utils/bibleScope";
import { demoBibles } from "@/utils/demoBibles";

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
    expect(SELECTED_BIBLE_IDS).toEqual(demoBibles.map((bible) => bible.id));
    expect(SELECTED_BIBLE_IDS.length).toBeGreaterThan(0);
  });
});
