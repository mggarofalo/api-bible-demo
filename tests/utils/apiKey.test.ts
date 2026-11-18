import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { API_KEY_PLACEHOLDER, getApiKey, isApiKeySet } from "@/utils/apiKey";

describe("getApiKey", () => {
  it("returns the key", () => {
    vi.stubEnv("API_BIBLE_API_KEY", "key-123");
    expect(getApiKey()).toBe("key-123");
  });

  it("removes the spaces around the key", () => {
    vi.stubEnv("API_BIBLE_API_KEY", "  key-123\n");
    expect(getApiKey()).toBe("key-123");
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["only spaces", "   "],
    ["the value of the .env.example file", API_KEY_PLACEHOLDER],
    ["the value of the .env.example file with spaces", ` ${API_KEY_PLACEHOLDER} `],
  ])("returns no key when the variable is %s", (_name, value) => {
    vi.stubEnv("API_BIBLE_API_KEY", value);
    expect(getApiKey()).toBeUndefined();
  });
});

describe("isApiKeySet", () => {
  it("is true when the key is set", () => {
    vi.stubEnv("API_BIBLE_API_KEY", "key-123");
    expect(isApiKeySet()).toBe(true);
  });

  it("is false when the key is not set", () => {
    vi.stubEnv("API_BIBLE_API_KEY", "");
    expect(isApiKeySet()).toBe(false);
  });
});

describe("API_KEY_PLACEHOLDER", () => {
  it("is the value of the key in the .env.example file", () => {
    const example = readFileSync(
      new URL("../../.env.example", import.meta.url),
      "utf8",
    );
    expect(example).toMatch(
      new RegExp(`^API_BIBLE_API_KEY=${API_KEY_PLACEHOLDER}(\\s|$)`, "m"),
    );
  });
});
