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
      "/bibles$",
      "/bibles/*/books$",
      "/bibles/*/books/*/chapters$",
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

  //Crawlers use the longest rule that matches the URL, and allow wins a tie. A `*` in a rule
  //matches any text. A `$` at the end of a rule matches the end of the URL. Allow "/" matches
  //every URL, so a longer disallow rule must beat it.
  describe("which URLs a crawler may visit", () => {
    const toRegExp = (rule: string) => {
      const anchored = rule.endsWith("$");
      const pattern = (anchored ? rule.slice(0, -1) : rule)
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp(`^${pattern}${anchored ? "$" : ""}`);
    };
    const longestMatch = (list: string[], url: string) =>
      Math.max(0, ...list.filter((rule) => toRegExp(rule).test(url)).map((rule) => rule.length));
    const crawlable = (url: string) => {
      const { allow, disallow } = rules();
      return longestMatch(allow as string[], url) >= longestMatch(disallow as string[], url);
    };

    it.each([
      "/",
      "/bibles",
      "/bibles/abc-01/books",
      "/bibles/abc-01/books/GEN/chapters",
      //Pages that no longer rule names are open, because allow "/" matches them
      "/bibles/abc-01",
      "/bibles/abc-01/books/GEN",
      "/bibles/abc-01/chapters/GEN.1",
    ])("lets crawlers visit %s", (url) => {
      expect(crawlable(url)).toBe(true);
    });

    it.each([
      "/api/verses",
      "/?page=2",
      "/bibles/abc-01/verses/GEN.1.1",
      "/bibles/abc-01/passages/GEN.1",
      "/bibles/abc-01/sections/GEN.1",
      "/bibles/abc-01/search",
      "/bibles/abc-01/chapters/GEN.1/verses",
      "/bibles/abc-01/chapters/GEN.1/sections",
      "/bibles/abc-01/books/GEN/sections",
    ])("keeps crawlers out of %s", (url) => {
      expect(crawlable(url)).toBe(false);
    });

    //A URL with query parameters is a different request to the API, also on an overview page
    it.each([
      "/bibles?language=eng",
      "/bibles/abc-01?x=1",
      "/bibles/abc-01/books?include-chapters=true",
      "/bibles/abc-01/books/GEN/chapters?x=1",
      "/bibles/abc-01/chapters/GEN.1?content-type=text",
    ])("keeps crawlers out of %s, which has query parameters", (url) => {
      expect(crawlable(url)).toBe(false);
    });
  });

  it("does not set a sitemap", () => {
    expect(robots().sitemap).toBeUndefined();
  });
});
