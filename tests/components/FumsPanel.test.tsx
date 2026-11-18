import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  //The shim of the root layout makes this function before each page shows
  window.fums = vi.fn();
});

afterEach(() => {
  delete window.fums;
  vi.useRealTimers();
});

const LONG_TOKEN = "abcdefghijklmnopqrstuvwxyz";

const toggleButton = () => screen.getByRole("button", { name: /FUMS/ });
const activity = () => screen.getByRole("complementary", { name: "FUMS activity" });

describe("FumsPanel", () => {
  it("is closed with no reports and opens to say there is no report", async () => {
    const user = userEvent.setup();
    render(<panel.FumsPanel />);

    expect(toggleButton()).toHaveAttribute("aria-expanded", "false");
    expect(toggleButton()).toHaveTextContent("FUMS0 sent");
    expect(toggleButton()).not.toHaveTextContent("waiting");
    expect(screen.queryByText(/No report yet/)).not.toBeInTheDocument();

    await user.click(toggleButton());
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/No report yet/)).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "FUMS documentation, opens in a new window",
    });
    expect(link).toHaveAttribute("href", "https://docs.api.bible/resources/fair-use");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

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
    expect(toggleButton()).toHaveTextContent("0 sent, 1 waiting");

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
      {
        id: 1,
        token: "tok",
        path: "/bibles/x/verses/JHN.3.16",
        cached: true,
        at: expect.any(Number),
      },
    ]);
    delete window.fums;
  });

  describe("a new report for the same token", () => {
    //The store skips the same token in the same second, so each step is 2 s later
    let now = 1_000_000;
    beforeEach(() => {
      now = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
    });

    it("reports the token again on a new page", () => {
      navigation.pathname = "/bibles/a";
      const { rerender } = render(<panel.FumsReporter token="tok" />);
      now += 2000;
      navigation.pathname = "/bibles/b";
      rerender(<panel.FumsReporter token="tok" />);

      expect(fums.fumsStore.getSnapshot().reports.map(({ path }) => path)).toEqual([
        "/bibles/a",
        "/bibles/b",
      ]);
    });

    it("reports the token again when the same page shows a response from the cache", () => {
      const { rerender } = render(<panel.FumsReporter token="tok" />);
      now += 2000;
      rerender(<panel.FumsReporter token="tok" cached />);

      expect(fums.fumsStore.getSnapshot().reports.map(({ cached }) => cached)).toEqual([
        false,
        true,
      ]);
    });

    it("does not report again when nothing changes", () => {
      const { rerender } = render(<panel.FumsReporter token="tok" />);
      now += 2000;
      rerender(<panel.FumsReporter token="tok" />);
      expect(fums.fumsStore.getSnapshot().reports).toHaveLength(1);
    });
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
    expect(toggleButton()).toHaveTextContent("0 sent, 2 waiting");

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

    expect(toggleButton()).toHaveTextContent("0 sent, 4 waiting");
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

  it("shows steps 3 and 4 as waiting until the request is recorded, then as done", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    //Each step starts with its state as text for a screen reader
    const waiting = () =>
      within(activity())
        .getAllByRole("listitem")
        .map((step) => {
          const text = step.textContent ?? "";
          expect(text).toMatch(/^(Done:|In progress:|Not done:)/);
          return text.startsWith("In progress:");
        });
    expect(waiting()).toEqual([false, false, true, true]);

    sendEntries([{ name: "https://fums.api.bible/f3?t=tok", duration: 4 }]);
    expect(waiting()).toEqual([false, false, false, false]);
  });

  it("says sent when the browser does not show the status", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    sendEntries([{ name: "https://fums.api.bible/f3?t=tok", duration: 4 }]);
    const step = within(activity()).getAllByRole("listitem")[3];
    expect(step).toHaveTextContent(
      "Sent in 4 ms. The browser does not show the status of a request to a different site.",
    );
    expect(step).not.toHaveTextContent("Status");
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
    render(<panel.FumsPanel />);
    act(() => {
      for (let i = 1; i <= fums.MAX_FUMS_REPORTS + 5; i++) {
        fums.reportFumsToken(`token-${i}`, "/a", false);
      }
    });
    //token-1 was dropped, so its request changes nothing
    sendEntries([
      { name: "https://fums.api.bible/f3?t=token-1&t=token-6&t=token-7", duration: 4 },
    ]);
    expect(toggleButton()).toHaveTextContent(
      `2 sent, ${fums.MAX_FUMS_REPORTS + 3} waiting`,
    );
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
    expect(toggleButton()).toHaveTextContent("0 sent, 1 waiting");
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

  describe("the header", () => {
    it("says only sent when no report waits", () => {
      render(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok" />
        </>,
      );
      sendEntries([{ name: "https://fums.api.bible/f3?t=tok", duration: 4 }]);
      expect(toggleButton()).toHaveTextContent("FUMS1 sent");
      expect(toggleButton()).not.toHaveTextContent("waiting");
    });

    it("says how many reports were sent and how many wait", () => {
      act(() => {
        fums.reportFumsToken("a", "/a", false);
        fums.reportFumsToken("b", "/b", false);
        fums.reportFumsToken("c", "/c", false);
      });
      render(<panel.FumsPanel />);
      sendEntries([{ name: "https://fums.api.bible/f3?t=a&t=c", duration: 4 }]);
      expect(toggleButton()).toHaveTextContent("FUMS2 sent, 1 waiting");
    });
  });

  describe("steps 3 and 4 with no request", () => {
    const stepStates = () =>
      within(activity())
        .getAllByRole("listitem")
        .map((step) => /^(Done|In progress|Not done):/.exec(step.textContent ?? "")?.[1]);
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("exports a delay of 5 seconds", () => {
      expect(panel.FUMS_REQUEST_TIMEOUT_MS).toBe(5000);
    });

    it("are in progress at 4999 ms and not done at 5000 ms", () => {
      render(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok" />
        </>,
      );
      advance(4999);
      expect(stepStates()).toEqual(["Done", "Done", "In progress", "In progress"]);
      expect(screen.getByText("Wait for the script.")).toBeInTheDocument();

      advance(1);
      expect(stepStates()).toEqual(["Done", "Done", "Not done", "Not done"]);
      const steps = within(activity()).getAllByRole("listitem");
      expect(steps[2]).toHaveTextContent("No request after 5 seconds.");
      expect(steps[3]).toHaveTextContent(
        "No request after 5 seconds. A content blocker can stop the FUMS script.",
      );
      expect(screen.queryByText("Wait for the script.")).not.toBeInTheDocument();
      //The report is still counted as waiting: its request can come later
      expect(toggleButton()).toHaveTextContent("0 sent, 1 waiting");
    });

    it("become done when the request comes after 5 seconds", () => {
      render(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok" />
        </>,
      );
      advance(6000);
      expect(stepStates()).toEqual(["Done", "Done", "Not done", "Not done"]);

      sendEntries([{ name: "https://fums.api.bible/f3?t=tok", duration: 4 }]);
      expect(stepStates()).toEqual(["Done", "Done", "Done", "Done"]);
      expect(toggleButton()).toHaveTextContent("1 sent");
    });

    it("stay done when the request comes before 5 seconds", () => {
      render(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok" />
        </>,
      );
      advance(1000);
      sendEntries([{ name: "https://fums.api.bible/f3?t=tok", duration: 4 }]);
      advance(10_000);
      expect(stepStates()).toEqual(["Done", "Done", "Done", "Done"]);
    });

    it("count the 5 seconds from the time of the report", () => {
      //The user left the page, so the panel starts closed
      act(() => {
        fums.reportFumsToken("tok", "/a", false);
        fums.leaveFumsPage("tok");
      });
      advance(3000);
      render(<panel.FumsPanel />);
      fireEvent.click(toggleButton());

      advance(1999);
      expect(stepStates()).toEqual(["Done", "Done", "In progress", "In progress"]);
      advance(1);
      expect(stepStates()).toEqual(["Done", "Done", "Not done", "Not done"]);
    });

    it("are not done at once for a report older than 5 seconds", () => {
      //The user left the page, so the panel starts closed
      act(() => {
        fums.reportFumsToken("tok", "/a", false);
        fums.leaveFumsPage("tok");
      });
      advance(8000);
      render(<panel.FumsPanel />);
      fireEvent.click(toggleButton());
      advance(0);
      expect(stepStates()).toEqual(["Done", "Done", "Not done", "Not done"]);
    });

    it("start in progress again for a new report", () => {
      const { rerender } = render(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok" />
        </>,
      );
      advance(5000);
      expect(stepStates()).toEqual(["Done", "Done", "Not done", "Not done"]);

      rerender(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok-2" />
        </>,
      );
      expect(screen.getByText(/tok-2/)).toBeInTheDocument();
      expect(stepStates()).toEqual(["Done", "Done", "In progress", "In progress"]);
      advance(4999);
      expect(stepStates()).toEqual(["Done", "Done", "In progress", "In progress"]);
    });

    it("stop the timer when the panel unmounts", () => {
      const { unmount } = render(
        <>
          <panel.FumsPanel />
          <panel.FumsReporter token="tok" />
        </>,
      );
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("gives the status when the browser shows it", () => {
    render(
      <>
        <panel.FumsPanel />
        <panel.FumsReporter token="tok" />
      </>,
    );
    sendEntries([
      { name: "https://fums.api.bible/f3?t=tok", duration: 4, responseStatus: 204 },
    ]);
    const step = within(activity()).getAllByRole("listitem")[3];
    expect(step).toHaveTextContent("Status 204 in 4 ms");
    expect(step).not.toHaveTextContent("Sent in");
    expect(step).not.toHaveTextContent("different site");
  });
});
