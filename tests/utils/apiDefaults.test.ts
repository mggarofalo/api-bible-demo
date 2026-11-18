import { describe, expect, it } from "vitest";
import { getApiDefaults, removeApiDefaults } from "@/utils/apiDefaults";

describe("getApiDefaults", () => {
  it("returns the defaults of the parameters that have one", () => {
    expect(getApiDefaults("/bibles/abc-01/search")).toEqual({
      limit: "10",
      offset: "0",
      sort: "relevance",
    });
  });

  it("works for a demo page path with a version prefix", () => {
    expect(getApiDefaults("/v1/bibles")).toEqual({
      "include-full-details": "false",
    });
  });

  it("includes the content defaults of a verse", () => {
    expect(getApiDefaults("/bibles/a/verses/GEN.1.1")).toMatchObject({
      "content-type": "html",
      "include-titles": "true",
      "use-org-id": "false",
    });
  });

  it("returns an empty object for an endpoint with no defaults", () => {
    expect(getApiDefaults("/bibles/abc-01")).toEqual({});
  });

  it("returns an empty object for an unknown path", () => {
    expect(getApiDefaults("/unknown")).toEqual({});
  });
});

describe("removeApiDefaults", () => {
  it("removes parameters that have the default value", () => {
    const url = new URL(
      "https://api.example.com/v1/bibles/abc-01/search?query=love&limit=10&offset=0",
    );
    expect(removeApiDefaults(url).search).toBe("?query=love");
  });

  it("keeps parameters that differ from the default", () => {
    const url = new URL(
      "https://api.example.com/v1/bibles/abc-01/search?limit=25&sort=canonical",
    );
    expect(removeApiDefaults(url).search).toBe("?limit=25&sort=canonical");
  });

  it("returns the same URL object", () => {
    const url = new URL(
      "https://api.example.com/v1/bibles?include-full-details=false",
    );
    expect(removeApiDefaults(url)).toBe(url);
    expect(url.search).toBe("");
  });

  it("leaves a URL of an unknown endpoint alone", () => {
    const url = new URL("https://api.example.com/other?limit=10");
    expect(removeApiDefaults(url).search).toBe("?limit=10");
  });

  it("does not add parameters that are absent", () => {
    const url = new URL("https://api.example.com/v1/bibles/abc-01/search");
    expect(removeApiDefaults(url).search).toBe("");
  });
});
