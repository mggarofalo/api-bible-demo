import { describe, expect, it } from "vitest";
import { coverage } from "@/parity/coverage.mjs";
import reference from "@/parity/api-reference.json";

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

  it("keeps the audio endpoints deferred", () => {
    const audio = entries.filter(([path]) => path.startsWith("/audio-bibles"));
    expect(audio.length).toBeGreaterThan(0);
    for (const [path, entry] of audio) {
      expect(entry.deferred, path).toBeTruthy();
    }
  });
});
