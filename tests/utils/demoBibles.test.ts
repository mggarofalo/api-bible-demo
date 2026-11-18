import { describe, expect, it } from "vitest";
import { demoBibles, hasSections } from "@/utils/demoBibles";

describe("demoBibles", () => {
  it("has no Bible in the list two times", () => {
    const ids = demoBibles.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("says if a Bible of the list has sections", () => {
    for (const bible of demoBibles) {
      expect(hasSections(bible.id)).toBe(bible.hasSections);
    }
  });

  it("says that a Bible that is not in the list has no sections", () => {
    expect(hasSections("not-a-bible")).toBe(false);
  });
});
