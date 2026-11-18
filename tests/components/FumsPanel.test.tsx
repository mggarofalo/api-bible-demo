import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/bibles/a" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

type FumsModule = typeof import("@/utils/fums");
type PanelModule = typeof import("@/components/FumsPanel");

let fums: FumsModule;
let panel: PanelModule;

//A fake of the browser's list of network requests
type Entry = { name: string; duration: number; responseStatus?: number };
let observerCallback: ((list: { getEntries: () => Entry[] }) => void) | undefined;
const observe = vi.fn();
const disconnect = vi.fn();
class FakePerformanceObserver {
  constructor(callback: typeof observerCallback) {
    observerCallback = callback;
  }
  observe = observe;
  disconnect = disconnect;
}

const sendEntries = (entries: Entry[]) =>
  act(() => observerCallback?.({ getEntries: () => entries }));

//The store is module-level state, so each test gets a new copy of the modules
beforeEach(async () => {
  vi.resetModules();
  fums = await import("@/utils/fums");
  panel = await import("@/components/FumsPanel");
  navigation.pathname = "/bibles/a";
  observerCallback = undefined;
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal("PerformanceObserver", FakePerformanceObserver);
});

const LONG_TOKEN = "abcdefghijklmnopqrstuvwxyz";

const toggleButton = () => screen.getByRole("button", { name: /FUMS/ });
const activity = () => screen.getByRole("complementary", { name: "FUMS activity" });

describe("FumsPanel", () => {
  it("is closed with no reports and opens to say there is no report", async () => {
    const user = userEvent.setup();
    render(<panel.FumsPanel />);

    expect(toggleButton()).toHaveAttribute("aria-expanded", "false");
    expect(toggleButton()).toHaveTextContent("0 reports");
    expect(screen.queryByText(/No report yet/)).not.toBeInTheDocument();

    await user.click(toggleButton());
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/No report yet/)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "FUMS documentation" });
    expect(link).toHaveAttribute("href", "https://docs.api.bible/resources/fair-use");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");

    await user.click(toggleButton());
    expect(toggleButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens and shows the steps when a page reports a token", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token={LONG_TOKEN} />
      </>,
    );

    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");
    expect(toggleButton()).toHaveTextContent("1 report");
    expect(toggleButton()).not.toHaveTextContent("1 reports");

    const steps = within(activity()).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent("1. The API gave a token");
    expect(steps[0]).toHaveTextContent("meta.fumsToken = abcdef…wxyz");
    expect(steps[0]).not.toHaveTextContent("From a response in the cache");
    expect(steps[1]).toHaveTextContent('fums("trackView", token)');
    expect(steps[2]).toHaveTextContent("Wait for the script.");
    expect(steps[3]).toHaveTextContent("Wait for the request.");
  });

  it("shows a short token in full", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="short-token" />
      </>,
    );
    expect(screen.getByText(/meta\.fumsToken/).parentElement).toHaveTextContent(
      "meta.fumsToken = short-token",
    );
  });

  it("says when the token came from the cache", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="cached-token" cached />
      </>,
    );
    expect(
      screen.getByText(/From a response in the cache\. Each view is a report\./),
    ).toBeInTheDocument();
  });

  it("sends the token to the FUMS script with the path of the page", () => {
    window.fums = vi.fn();
    navigation.pathname = "/bibles/x/verses/JHN.3.16";
    render(<panel.FumsReporter token="tok" cached />);

    expect(window.fums).toHaveBeenCalledWith("trackView", "tok");
    expect(fums.fumsStore.getSnapshot().reports).toEqual([
      { id: 1, token: "tok", path: "/bibles/x/verses/JHN.3.16", cached: true },
    ]);
    delete window.fums;
  });

  it("reports nothing for a page with no token", () => {
    const { container } = render(<panel.FumsReporter />);
    expect(container).toBeEmptyDOMElement();
    expect(fums.fumsStore.getSnapshot().reports).toHaveLength(0);
  });

  it("closes when the page leaves and shows the last report when opened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="first-token" />
      </>,
    );
    rerender(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="second-token" />
      </>,
    );
    rerender(<panel.FumsPanel />);

    expect(toggleButton()).toHaveAttribute("aria-expanded", "false");
    expect(toggleButton()).toHaveTextContent("2 reports");

    await user.click(toggleButton());
    expect(screen.getByText(/second-token/)).toBeInTheDocument();
    expect(screen.queryByText(/first-token/)).not.toBeInTheDocument();
  });

  it("shows the report of the active token when there are several reports", () => {
    act(() => {
      fums.reportFumsToken("token-a", "/a", false);
      fums.reportFumsToken("token-b", "/b", false);
      fums.reportFumsToken("token-c", "/c", false);
      fums.reportFumsToken("token-b", "/b", true);
    });
    render(<panel.FumsPanel />);

    expect(toggleButton()).toHaveTextContent("4 reports");
    //The newest report of the active token is the one with the cache note
    expect(screen.getByText(/token-b/)).toBeInTheDocument();
    expect(screen.getByText(/From a response in the cache/)).toBeInTheDocument();
  });

  it("shows the IDs and the status of the request to the FUMS server", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    expect(observe).toHaveBeenCalledWith({ type: "resource", buffered: true });

    sendEntries([
      { name: "https://example.com/other?t=tok", duration: 1 },
      {
        name: `https://fums.api.bible/f3?t=tok&dId=${LONG_TOKEN}&sId=session-1`,
        duration: 12.6,
        responseStatus: 200,
      },
    ]);

    const steps = within(activity()).getAllByRole("listitem");
    expect(steps[2]).toHaveTextContent("Device dId = abcdef…wxyz");
    expect(steps[2]).toHaveTextContent("Session sId = session-1");
    expect(steps[2]).toHaveTextContent("User uId = none");
    expect(steps[2]).toHaveTextContent('(SHA-256 hash of "demo-user")');
    expect(steps[3]).toHaveTextContent("GET fums.api.bible/f3");
    expect(steps[3]).toHaveTextContent("Status 200 in 13 ms");
  });

  it("says sent when the browser does not show the status", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    sendEntries([{ name: "https://fums.api.bible/f3?t=tok", duration: 4 }]);
    expect(within(activity()).getAllByRole("listitem")[3]).toHaveTextContent(
      "Sent in 4 ms",
    );
  });

  it("ignores requests to other sites", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    sendEntries([{ name: "https://example.com/f3?t=tok", duration: 4 }]);
    expect(fums.fumsStore.getSnapshot().reports[0].request).toBeUndefined();
    expect(screen.getByText("Wait for the request.")).toBeInTheDocument();
  });

  it("ignores requests that only look like the FUMS server", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    sendEntries([
      { name: "https://rest.api.bible/v1/bibles?t=tok", duration: 4 },
      { name: "https://api.bible/fums?t=tok", duration: 4 },
      { name: "https://example.com/?next=https://fums.api.bible/f3", duration: 4 },
      { name: "https://fums.api.bible.evil.test/f3?t=tok", duration: 4 },
      { name: "https://fums.api.bible@evil.test/f3?t=tok", duration: 4 },
      { name: "https://fums.api.bible:8443/f3?t=tok", duration: 4 },
      { name: "http://fums.api.bible/f3?t=tok", duration: 4 },
    ]);
    expect(fums.fumsStore.getSnapshot().reports[0].request).toBeUndefined();
    expect(screen.getByText("Wait for the request.")).toBeInTheDocument();
  });

  it("ignores a request with a URL that is not valid", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    sendEntries([
      { name: "https://fums.api.bible:bad/f3?t=tok", duration: 4 },
      { name: "https://fums.api.bible/f3?t=tok", duration: 4, responseStatus: 200 },
    ]);
    expect(fums.fumsStore.getSnapshot().reports[0].request?.status).toBe(200);
  });

  it("counts all reports of the session, also the ones the store dropped", () => {
    act(() => {
      for (let i = 1; i <= fums.MAX_FUMS_REPORTS + 5; i++) {
        fums.reportFumsToken(`token-${i}`, "/a", false);
      }
    });
    render(<panel.FumsPanel />);
    expect(toggleButton()).toHaveTextContent(`${fums.MAX_FUMS_REPORTS + 5} reports`);
  });

  it("stops reading requests when it unmounts", () => {
    const { unmount } = render(<panel.FumsPanel />);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("works when the browser has no PerformanceObserver", () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    expect(observerCallback).toBeUndefined();
    expect(toggleButton()).toHaveTextContent("1 report");
  });

  it("keeps the choice of the user on the same page only", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");

    await user.click(toggleButton());
    expect(toggleButton()).toHaveAttribute("aria-expanded", "false");

    //A new page starts with the default again, which is open on a page with a token
    navigation.pathname = "/bibles/b";
    rerender(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok-2" />
      </>,
    );
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");
  });
});
