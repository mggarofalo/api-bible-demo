import { describe, expect, it } from "vitest";
import { coverage } from "@/parity/coverage.mjs";
import reference from "@/parity/api-reference.json";
import { createBibleClient } from "@americanbible/api-bible-sdk";
import { demoBibles, hasSections } from "@/utils/demoBibles";

type Entry = {
  ids?: Record<string, string>;
  sdk?: string;
  params?: Record<
    string,
    { sample?: string; page?: string; expect?: string; deferred?: string }
  >;
  deferred?: string;
};

const manifest = coverage as Record<string, Entry>;
const endpoints = reference.endpoints as Record<
  string,
  { methods: string[]; parameters: Record<string, { default?: string }> }
>;
const entries = Object.entries(manifest);
const covered = entries.filter(([, entry]) => !entry.deferred);
const deferred = entries.filter(([, entry]) => entry.deferred);

const placeholders = (path: string) =>
  [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);

describe("coverage manifest", () => {
  it("has the same endpoints as the API reference snapshot", () => {
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(endpoints).sort());
  });

  it("has both covered and deferred entries", () => {
    expect(covered.length).toBeGreaterThan(0);
    expect(deferred.length).toBeGreaterThan(0);
  });

  it("gives every deferred entry a reason and nothing else", () => {
    for (const [path, entry] of deferred) {
      expect(entry.deferred?.trim(), path).toBeTruthy();
      expect(entry.sdk, path).toBeUndefined();
      expect(entry.params, path).toBeUndefined();
    }
  });

  it("gives every covered entry an SDK method as resource.method", () => {
    for (const [path, entry] of covered) {
      expect(entry.sdk, path).toMatch(/^[a-z]+\.[A-Za-z]+$/);
    }
  });

  it("gives every covered entry a sample for each ID in its path", () => {
    for (const [path, entry] of covered) {
      expect(Object.keys(entry.ids ?? {}).sort(), path).toEqual(
        placeholders(path).sort(),
      );
      for (const value of Object.values(entry.ids ?? {})) {
        expect(value.trim(), path).not.toBe("");
      }
    }
  });

  it("has the same query parameters as the reference for covered entries", () => {
    for (const [path, entry] of covered) {
      expect(Object.keys(entry.params ?? {}).sort(), path).toEqual(
        Object.keys(endpoints[path].parameters).sort(),
      );
    }
  });

  it("gives every parameter a sample or a reason it is deferred", () => {
    for (const [path, entry] of covered) {
      for (const [name, param] of Object.entries(entry.params ?? {})) {
        const label = `${path} ${name}`;
        if (param.deferred) {
          expect(param.deferred.trim(), label).not.toBe("");
        } else {
          expect(param.sample, label).toEqual(expect.any(String));
          expect(param.sample, label).not.toBe("");
        }
      }
    }
  });

  it("covers only endpoints that use the GET method", () => {
    for (const [path] of covered) {
      expect(endpoints[path].methods, path).toEqual(["get"]);
    }
  });

  it("uses a value that differs from the API default", () => {
    for (const [path, entry] of covered) {
      for (const [name, param] of Object.entries(entry.params ?? {})) {
        if (param.deferred) continue;
        expect(param.expect ?? param.sample, `${path} ${name}`).not.toBe(
          endpoints[path].parameters[name].default,
        );
      }
    }
  });

  it("names an SDK method that exists on the real client", () => {
    //Constructing the client makes no request
    const client = createBibleClient({ apiKey: "dummy" }) as unknown as Record<
      string,
      Record<string, unknown> | undefined
    >;
    for (const [path, entry] of covered) {
      const [resource, method] = (entry.sdk ?? "").split(".");
      expect(typeof client[resource]?.[method], `${path} ${entry.sdk}`).toBe(
        "function",
      );
    }
  });

  it("uses Bibles of the demo list for every sample Bible ID", () => {
    const demoIds = demoBibles.map(({ id }) => id);
    for (const [path, entry] of covered) {
      const bibleId = entry.ids?.bibleId;
      if (bibleId) {
        expect(demoIds, path).toContain(bibleId);
      }
    }
    //The Bibles that are used as sample values for parallels are in the list too
    for (const [path, entry] of covered) {
      for (const [name, param] of Object.entries(entry.params ?? {})) {
        if (name === "parallels" || name === "ids") {
          for (const id of (param.sample ?? "").split(",")) {
            expect(demoIds, `${path} ${name}`).toContain(id.trim());
          }
        }
      }
    }
  });

  it("uses a Bible with sections for the endpoints that need sections", () => {
    const needsSections = covered.filter(
      ([path, entry]) =>
        path.endsWith("/sections") ||
        path.includes("/sections/") ||
        entry.sdk?.startsWith("sections.") ||
        "include-chapters-and-sections" in (entry.params ?? {}),
    );
    expect(needsSections.length).toBeGreaterThan(0);
    for (const [path, entry] of needsSections) {
      expect(hasSections(entry.ids?.bibleId ?? ""), path).toBe(true);
    }
  });

  it("keeps the audio endpoints deferred", () => {
    const audio = entries.filter(([path]) => path.startsWith("/audio-bibles"));
    expect(audio.length).toBeGreaterThan(0);
    for (const [path, entry] of audio) {
      expect(entry.deferred, path).toBeTruthy();
    }
  });
});
