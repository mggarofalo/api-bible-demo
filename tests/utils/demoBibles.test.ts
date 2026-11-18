import { describe, expect, it } from "vitest";
import { demoBibles, hasSections } from "@/utils/demoBibles";

//A deliberate change to the list of demo Bibles must update these literals.
const EXPECTED_IDS = [
  "de4e12af7f28f599-01",
  "179568874c45066f-01",
  "9879dbb7cfe39e4d-01",
  "685d1470fe4d5c3b-01",
  "bba9f40183526463-01",
  "55212e3cf5d04d49-01",
  "01b29f4b342acc35-01",
  "f72b840c855f362c-04",
  "65eec8e0b60e656b-01",
  "c315fa9f71d4af3a-01",
  "40072c4a5aba4022-01",
];
const EXPECTED_WITH_SECTIONS = ["bba9f40183526463-01"];

describe("demoBibles", () => {
  it("has 11 Bibles", () => {
    expect(demoBibles).toHaveLength(11);
  });

  it("has the expected IDs in order", () => {
    expect(demoBibles.map(({ id }) => id)).toEqual(EXPECTED_IDS);
  });

  it("marks only the expected Bibles as having sections", () => {
    expect(
      demoBibles.filter(({ hasSections }) => hasSections).map(({ id }) => id),
    ).toEqual(EXPECTED_WITH_SECTIONS);
  });

  it("says that the listed Bibles have sections as expected", () => {
    for (const id of EXPECTED_IDS) {
      expect(hasSections(id), id).toBe(EXPECTED_WITH_SECTIONS.includes(id));
    }
  });

  it("says that a Bible that is not in the list has no sections", () => {
    expect(hasSections("not-a-bible")).toBe(false);
  });
});
