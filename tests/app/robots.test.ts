import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

const rules = () => {
  const { rules } = robots();
  if (Array.isArray(rules) || !rules) throw new Error("Expected one rule");
  return rules;
};

describe("robots", () => {
  it("has one rule for all crawlers", () => {
    expect(rules().userAgent).toBe("*");
  });

  it("allows the overview pages", () => {
    expect(rules().allow).toEqual([
      "/",
      "/bibles",
      "/bibles/*/books",
      "/bibles/*/books/*/chapters",
    ]);
  });

  it("disallows the generated pages and the API route", () => {
    expect(rules().disallow).toEqual(
      expect.arrayContaining([
        "/*?",
        "/api/",
        "/bibles/*/verses/",
        "/bibles/*/passages/",
        "/bibles/*/sections/",
        "/bibles/*/search",
        "/bibles/*/chapters/*/verses",
        "/bibles/*/chapters/*/sections",
        "/bibles/*/books/*/sections",
      ]),
    );
  });

  it("does not allow and disallow the same path", () => {
    const { allow, disallow } = rules();
    const blocked = new Set(disallow as string[]);
    for (const path of allow as string[]) {
      expect(blocked.has(path)).toBe(false);
    }
  });

  it("does not set a sitemap", () => {
    expect(robots().sitemap).toBeUndefined();
  });
});
