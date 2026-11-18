import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FumsModule = typeof import("@/utils/fums");
type FumsWindow = Window & { fumsData?: unknown[] };

let fums: FumsModule;

//The store is module-level state, so each test gets a new copy of the module
beforeEach(async () => {
  vi.resetModules();
  fums = await import("@/utils/fums");
});

afterEach(() => {
  delete window.fums;
  delete (window as FumsWindow).fumsData;
});

const fumsUrl = (tokens: string[], ids: Record<string, string> = {}) => {
  const url = new URL(`${fums.FUMS_SERVER}/f3`);
  tokens.forEach((token) => url.searchParams.append("t", token));
  Object.entries(ids).forEach(([name, value]) => url.searchParams.set(name, value));
  return url;
};

describe("constants", () => {
  it("point to the API.Bible FUMS addresses", () => {
    expect(fums.FUMS_DOCS_URL).toBe("https://docs.api.bible/resources/fair-use");
    expect(fums.FUMS_SCRIPT_URL).toBe("https://pkg.api.bible/fumsV3.min.js");
    expect(fums.FUMS_SERVER).toBe("https://fums.api.bible");
    expect(fums.FUMS_DEMO_USER_ID).toBe("demo-user");
  });
});

describe("FUMS_SHIM_SCRIPT", () => {
  it("makes a fums function that queues calls and sets the user ID", () => {
    new Function(fums.FUMS_SHIM_SCRIPT)();

    const queue = (window as FumsWindow).fumsData as IArguments[];
    expect(typeof window.fums).toBe("function");
    expect(queue).toHaveLength(1);
    expect(Array.from(queue[0])).toEqual(["config", { userId: "demo-user" }]);

    window.fums?.("trackView", "abc");
    expect(queue).toHaveLength(2);
    expect(Array.from(queue[1])).toEqual(["trackView", "abc"]);
  });

  it("keeps a queue and a fums function that already exist", () => {
    const existing: unknown[] = ["earlier"];
    const fumsFunction = vi.fn();
    (window as FumsWindow).fumsData = existing;
    window.fums = fumsFunction;

    new Function(fums.FUMS_SHIM_SCRIPT)();

    expect((window as FumsWindow).fumsData).toBe(existing);
    expect(existing).toEqual(["earlier"]);
    expect(window.fums).toBe(fumsFunction);
    expect(fumsFunction).toHaveBeenCalledWith("config", { userId: "demo-user" });
  });
});

describe("fumsStore", () => {
  it("starts empty and the server snapshot is the same empty state", () => {
    const snapshot = fums.fumsStore.getSnapshot();
    expect(snapshot).toEqual({
      reports: [],
      activeToken: null,
      reported: 0,
      sent: 0,
    });
    expect(fums.fumsStore.getServerSnapshot()).toBe(snapshot);
  });

  it("gives the same snapshot when the active token reports again within one second", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    fums.reportFumsToken("a", "/a", false);
    const first = fums.fumsStore.getSnapshot();
    fums.reportFumsToken("a", "/a", false);
    expect(fums.fumsStore.getSnapshot()).toBe(first);
  });

  it("gives the same snapshot object while nothing changes", () => {
    fums.reportFumsToken("a", "/a", false);
    const first = fums.fumsStore.getSnapshot();
    expect(fums.fumsStore.getSnapshot()).toBe(first);

    //A request with no matching report changes nothing
    fums.recordFumsRequest(fumsUrl(["other"]), 200, 5);
    //Leaving a page that is not active changes nothing
    fums.leaveFumsPage("other");
    expect(fums.fumsStore.getSnapshot()).toBe(first);
  });

  it("keeps the server snapshot empty after reports", () => {
    fums.reportFumsToken("a", "/a", false);
    expect(fums.fumsStore.getServerSnapshot()).toEqual({
      reports: [],
      activeToken: null,
      reported: 0,
      sent: 0,
    });
  });

  it("calls each listener on a change and stops after unsubscribe", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = fums.fumsStore.subscribe(first);
    fums.fumsStore.subscribe(second);

    fums.reportFumsToken("a", "/a", false);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    fums.leaveFumsPage("a");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("does not call listeners when nothing changes", () => {
    const listener = vi.fn();
    fums.fumsStore.subscribe(listener);
    fums.leaveFumsPage("none");
    fums.recordFumsRequest(fumsUrl(["none"]), 200, 5);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("reportFumsToken", () => {
  it("sends the token to the FUMS script and records a report", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    window.fums = vi.fn();
    fums.reportFumsToken("token-1", "/bibles/1", false);

    expect(window.fums).toHaveBeenCalledWith("trackView", "token-1");
    expect(fums.fumsStore.getSnapshot()).toEqual({
      activeToken: "token-1",
      reports: [
        { id: 1, token: "token-1", path: "/bibles/1", cached: false, at: 10_000 },
      ],
      reported: 1,
      sent: 0,
    });
  });

  it("records a report when the FUMS script is not loaded", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    expect(() => fums.reportFumsToken("token-1", "/a", true)).not.toThrow();
    expect(fums.fumsStore.getSnapshot().reports).toEqual([
      { id: 1, token: "token-1", path: "/a", cached: true, at: 10_000 },
    ]);
  });

  it("counts each report in reported", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.reportFumsToken("b", "/b", false);
    expect(fums.fumsStore.getSnapshot().reported).toBe(2);
  });

  it("does not count a repeat within one second in reported", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    fums.reportFumsToken("a", "/a", false);
    fums.reportFumsToken("a", "/a", false);
    expect(fums.fumsStore.getSnapshot().reported).toBe(1);
  });

  it("keeps 50 reports", () => {
    expect(fums.MAX_FUMS_REPORTS).toBe(50);
  });

  it("gives each report the next ID and keeps all reports up to the limit", () => {
    const max = fums.MAX_FUMS_REPORTS;
    for (let i = 1; i <= max; i++) {
      fums.reportFumsToken(`token-${i}`, `/page-${i}`, i % 2 === 0);
    }
    const { reports, activeToken } = fums.fumsStore.getSnapshot();
    expect(reports).toHaveLength(max);
    expect(reports.map(({ id }) => id)).toEqual(
      Array.from({ length: max }, (_, i) => i + 1),
    );
    expect(reports[1].cached).toBe(true);
    expect(activeToken).toBe(`token-${max}`);
  });

  it("drops the oldest reports after the limit and keeps counting the IDs", () => {
    const max = fums.MAX_FUMS_REPORTS;
    for (let i = 1; i <= max + 5; i++) {
      fums.reportFumsToken(`token-${i}`, `/page-${i}`, false);
    }
    const { reports, activeToken } = fums.fumsStore.getSnapshot();
    expect(reports).toHaveLength(max);
    expect(reports[0]).toEqual({
      id: 6,
      token: "token-6",
      path: "/page-6",
      cached: false,
      at: expect.any(Number),
    });
    expect(reports.at(-1)?.id).toBe(max + 5);
    expect(activeToken).toBe(`token-${max + 5}`);
  });

  it("does not use an ID again after the oldest reports drop", () => {
    const max = fums.MAX_FUMS_REPORTS;
    for (let i = 1; i <= max * 2; i++) {
      fums.reportFumsToken(`token-${i}`, "/a", false);
    }
    const ids = fums.fumsStore.getSnapshot().reports.map(({ id }) => id);
    expect(new Set(ids).size).toBe(max);
    expect(ids).toEqual(Array.from({ length: max }, (_, i) => max + i + 1));
  });

  it("does not report the same token again within one second", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    window.fums = vi.fn();
    fums.reportFumsToken("a", "/a", false);
    fums.leaveFumsPage("a");
    expect(fums.fumsStore.getSnapshot().activeToken).toBeNull();

    now.mockReturnValue(10_999);
    fums.reportFumsToken("a", "/a", false);

    expect(window.fums).toHaveBeenCalledTimes(1);
    expect(fums.fumsStore.getSnapshot().reports).toHaveLength(1);
    //The page shows again, so its token is active again
    expect(fums.fumsStore.getSnapshot().activeToken).toBe("a");
  });

  it("reports the same token again after one second", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    window.fums = vi.fn();
    fums.reportFumsToken("a", "/a", false);

    now.mockReturnValue(11_000);
    fums.reportFumsToken("a", "/a", true);

    expect(window.fums).toHaveBeenCalledTimes(2);
    expect(fums.fumsStore.getSnapshot().reports).toEqual([
      { id: 1, token: "a", path: "/a", cached: false, at: 10_000 },
      { id: 2, token: "a", path: "/a", cached: true, at: 11_000 },
    ]);
  });

  it("reports a token again when a different token came between", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    fums.reportFumsToken("a", "/a", false);
    fums.reportFumsToken("b", "/b", false);
    fums.reportFumsToken("a", "/a", false);
    expect(fums.fumsStore.getSnapshot().reports.map(({ token }) => token)).toEqual([
      "a",
      "b",
      "a",
    ]);
  });
});

describe("leaveFumsPage", () => {
  it("clears the active token of the page that the user leaves", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.leaveFumsPage("a");
    const snapshot = fums.fumsStore.getSnapshot();
    expect(snapshot.activeToken).toBeNull();
    expect(snapshot.reports).toHaveLength(1);
  });

  it("changes nothing for a page whose report was dropped", () => {
    fums.reportFumsToken("old", "/old", false);
    for (let i = 1; i <= fums.MAX_FUMS_REPORTS; i++) {
      fums.reportFumsToken(`token-${i}`, "/a", false);
    }
    const before = fums.fumsStore.getSnapshot();
    expect(before.reports.some(({ token }) => token === "old")).toBe(false);

    expect(() => fums.leaveFumsPage("old")).not.toThrow();
    expect(fums.fumsStore.getSnapshot()).toBe(before);
  });

  it("keeps the active token when a different page leaves", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.reportFumsToken("b", "/b", false);
    fums.leaveFumsPage("a");
    expect(fums.fumsStore.getSnapshot().activeToken).toBe("b");
  });
});

describe("recordFumsRequest", () => {
  it("counts each report that gets a request as sent", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.reportFumsToken("b", "/b", false);
    expect(fums.fumsStore.getSnapshot().sent).toBe(0);

    fums.recordFumsRequest(fumsUrl(["a"]), 200, 1);
    expect(fums.fumsStore.getSnapshot().sent).toBe(1);
    fums.recordFumsRequest(fumsUrl(["b"]), 200, 1);
    expect(fums.fumsStore.getSnapshot().sent).toBe(2);
  });

  it("keeps the counters right after old reports drop", () => {
    const max = fums.MAX_FUMS_REPORTS;
    for (let i = 1; i <= max + 5; i++) {
      fums.reportFumsToken(`token-${i}`, "/a", false);
    }
    //token-1 to token-5 were dropped, so their requests change nothing
    const before = fums.fumsStore.getSnapshot();
    fums.recordFumsRequest(fumsUrl(["token-1", "token-5"]), 200, 1);
    expect(fums.fumsStore.getSnapshot()).toBe(before);

    fums.recordFumsRequest(fumsUrl(["token-1", "token-6", `token-${max + 5}`]), 200, 1);
    const { reports, reported, sent } = fums.fumsStore.getSnapshot();
    expect(reports).toHaveLength(max);
    expect(reported).toBe(max + 5);
    expect(sent).toBe(2);
  });

  it("attaches the request and its IDs to the report of the token", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.recordFumsRequest(
      fumsUrl(["a"], { dId: "device", sId: "session", uId: "user-hash" }),
      200,
      42,
    );
    expect(fums.fumsStore.getSnapshot().reports[0].request).toEqual({
      deviceId: "device",
      sessionId: "session",
      userId: "user-hash",
      status: 200,
      durationMs: 42,
    });
  });

  it("uses null for IDs that the URL does not have", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.recordFumsRequest(fumsUrl(["a"]), 0, 3);
    expect(fums.fumsStore.getSnapshot().reports[0].request).toEqual({
      deviceId: null,
      sessionId: null,
      userId: null,
      status: 0,
      durationMs: 3,
    });
  });

  it("attaches one request to each report of all tokens in the URL", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.reportFumsToken("b", "/b", false);
    fums.reportFumsToken("c", "/c", false);
    fums.recordFumsRequest(fumsUrl(["a", "c"]), 200, 1);

    const [a, b, c] = fums.fumsStore.getSnapshot().reports;
    expect(a.request?.status).toBe(200);
    expect(b.request).toBeUndefined();
    expect(c.request?.status).toBe(200);
    expect(fums.fumsStore.getSnapshot().sent).toBe(2);
  });

  it("attaches a request to the oldest report of its token that has none", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    fums.reportFumsToken("a", "/a", false);
    now.mockReturnValue(20_000);
    fums.reportFumsToken("a", "/a", false);

    fums.recordFumsRequest(fumsUrl(["a"]), 200, 1);
    let [first, second] = fums.fumsStore.getSnapshot().reports;
    expect(first.request?.durationMs).toBe(1);
    expect(second.request).toBeUndefined();

    fums.recordFumsRequest(fumsUrl(["a"]), 200, 2);
    [first, second] = fums.fumsStore.getSnapshot().reports;
    expect(first.request?.durationMs).toBe(1);
    expect(second.request?.durationMs).toBe(2);
  });

  it("attaches a token that the URL has two times to two reports", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    fums.reportFumsToken("a", "/a", false);
    now.mockReturnValue(20_000);
    fums.reportFumsToken("a", "/a", false);

    fums.recordFumsRequest(fumsUrl(["a", "a"]), 204, 7);
    const reports = fums.fumsStore.getSnapshot().reports;
    expect(reports.every(({ request }) => request?.status === 204)).toBe(true);
  });

  it("does not change a report that already has a request", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.recordFumsRequest(fumsUrl(["a"]), 200, 1);
    const before = fums.fumsStore.getSnapshot();

    fums.recordFumsRequest(fumsUrl(["a"]), 500, 9);
    expect(fums.fumsStore.getSnapshot()).toBe(before);
    expect(before.reports[0].request?.status).toBe(200);
    expect(before.sent).toBe(1);
  });

  it("ignores a request for a report that was dropped", () => {
    fums.reportFumsToken("old", "/old", false);
    for (let i = 1; i <= fums.MAX_FUMS_REPORTS; i++) {
      fums.reportFumsToken(`token-${i}`, "/a", false);
    }
    const before = fums.fumsStore.getSnapshot();

    expect(() => fums.recordFumsRequest(fumsUrl(["old"]), 200, 1)).not.toThrow();
    expect(fums.fumsStore.getSnapshot()).toBe(before);
    expect(before.reports.some(({ token }) => token === "old")).toBe(false);
  });

  it("attaches a request to a kept report when an older one was dropped", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    fums.reportFumsToken("a", "/a", false);
    for (let i = 1; i < fums.MAX_FUMS_REPORTS; i++) {
      fums.reportFumsToken(`token-${i}`, "/b", false);
    }
    now.mockReturnValue(20_000);
    //This report of "a" drops the first one
    fums.reportFumsToken("a", "/a", true);

    fums.recordFumsRequest(fumsUrl(["a"]), 200, 1);
    const reports = fums.fumsStore.getSnapshot().reports;
    expect(reports).toHaveLength(fums.MAX_FUMS_REPORTS);
    expect(reports.filter(({ token }) => token === "a")).toEqual([
      {
        id: fums.MAX_FUMS_REPORTS + 1,
        token: "a",
        path: "/a",
        cached: true,
        at: 20_000,
        request: expect.objectContaining({ status: 200 }),
      },
    ]);
  });

  it("keeps the active token", () => {
    fums.reportFumsToken("a", "/a", false);
    fums.recordFumsRequest(fumsUrl(["a"]), 200, 1);
    expect(fums.fumsStore.getSnapshot().activeToken).toBe("a");
  });
});
