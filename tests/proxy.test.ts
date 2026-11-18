import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

const request = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

describe("proxy", () => {
  describe("when the API key is set", () => {
    it.each(["/bibles", "/bibles/bible-1/books", "/api/bibles/bible-1/chapters/GEN.1/verses"])(
      "lets %s continue",
      (path) => {
        vi.stubEnv("API_BIBLE_API_KEY", "key-123");

        const response = request(path);

        expect(response.status).toBe(200);
        expect(response.headers.get("x-middleware-next")).toBe("1");
      },
    );
  });

  describe("when the API key is not set", () => {
    it.each(["/bibles", "/bibles/bible-1/verses/GEN.1.1?content-type=text"])(
      "sends %s to the home page",
      (path) => {
        vi.stubEnv("API_BIBLE_API_KEY", "");

        const response = request(path);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/");
      },
    );

    it("returns an error as JSON for a route handler", async () => {
      vi.stubEnv("API_BIBLE_API_KEY", "");

      const response = request("/api/bibles/bible-1/chapters/GEN.1/verses");

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: expect.stringContaining("API_BIBLE_API_KEY"),
      });
    });
  });
});

describe("config", () => {
  it.each([
    "/bibles",
    "/bibles/bible-1",
    "/bibles/bible-1/chapters/GEN.1/verses",
    "/api/bibles/bible-1/chapters/GEN.1/verses",
  ])("runs the proxy for %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(["/", "/robots.txt", "/assets/api-logo.svg", "/biblesque"])(
    "does not run the proxy for %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});
