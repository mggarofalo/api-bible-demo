/**
 * FUMS (Fair Use Management System) of API.Bible.
 *
 * API.Bible gives a `fumsToken` in the `meta` of each response that contains Scripture.
 * A web application must send each token back to the FUMS server, so API.Bible can tell
 * the copyright owners how their Bibles are used. See https://docs.api.bible/resources/fair-use.
 *
 * The FUMS script does the report. This demo does three things:
 *   1. The root layout loads the script and the small "shim" below.
 *   2. Each page that shows Scripture calls `reportFumsToken` when the page shows.
 *   3. The FUMS panel (components/FumsPanel.tsx) shows each report as a set of steps.
 */

/** Page of the API.Bible documentation that tells how to use FUMS */
export const FUMS_DOCS_URL = "https://docs.api.bible/resources/fair-use";
/** URL of the FUMS script that API.Bible supplies */
export const FUMS_SCRIPT_URL = "https://pkg.api.bible/fumsV3.min.js";
/** Address that the FUMS script sends its reports to */
export const FUMS_SERVER = "https://fums.api.bible";

/**
 * The user ID that the demo gives to FUMS. A real application gives the ID of the
 * logged-in user, and gives no ID when no user is logged in. The ID must not contain
 * personal data. The FUMS script sends a SHA-256 hash of the ID, not the ID.
 *
 * The demo has no users, so it uses this fixed sample ID to show the step.
 */
export const FUMS_DEMO_USER_ID = "demo-user";

/**
 * Runs before the FUMS script loads. It makes the `fums` function, which keeps each
 * call in `window.fumsData` until the script is ready. Then it sets the user ID.
 * This is the shim from the FUMS documentation.
 */
export const FUMS_SHIM_SCRIPT = `window.fumsData = window.fumsData || [];
window.fums = window.fums || function () { window.fumsData.push(arguments); };
fums("config", { userId: ${JSON.stringify(FUMS_DEMO_USER_ID)} });`;

declare global {
  interface Window {
    fums?: (command: string, value: unknown) => void;
  }
}

/**
 * Number of reports that the store keeps. When there are more, the oldest drop. The
 * FUMS panel shows only the newest report of a token, so it needs only the newest reports.
 */
export const MAX_FUMS_REPORTS = 50;

/** One report of a token to FUMS, as the FUMS panel shows it */
export type FumsReport = {
  /** Number of the report in the session. It counts up, also after old reports drop. */
  id: number;
  token: string;
  /** Path of the page that got the token */
  path: string;
  /** The token came from a response in the cache of the demo */
  cached: boolean;
  /** Time of the report, from `Date.now()` */
  at: number;
  /** The request that the FUMS script sent, when the browser has recorded it */
  request?: {
    deviceId: string | null;
    sessionId: string | null;
    /** The SHA-256 hash of the user ID */
    userId: string | null;
    /** HTTP status, or 0 if the browser does not show it for a request to a different site */
    status: number;
    durationMs: number;
  };
};

type FumsState = {
  /** The newest reports, up to `MAX_FUMS_REPORTS` */
  reports: FumsReport[];
  /** Token of the page that shows now, or `null` if the page has no Scripture */
  activeToken: string | null;
  /** Number of reports in the session. Reports that drop from the list stay in it. */
  reported: number;
  /**
   * Number of reports in the session that got a request to the FUMS server. Reports
   * that drop from the list stay in it. `reported - sent` reports wait for their request.
   */
  sent: number;
};

//One object for the empty state. React needs the same object each time it asks for the server state.
const EMPTY_STATE: FumsState = { reports: [], activeToken: null, reported: 0, sent: 0 };
let state = EMPTY_STATE;
const listeners = new Set<() => void>();
let lastReport = { token: "", at: 0 };

const setState = (next: FumsState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Store of FUMS activity, for `useSyncExternalStore` */
export const fumsStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,
  getServerSnapshot: () => EMPTY_STATE,
};

/**
 * Reports the token of a response to FUMS, and records the report for the FUMS panel.
 * Call it each time a page that contains Scripture shows: a view of the same page
 * at a later time is a new view, and gets a new report. This is also true when the
 * response came from the cache of the demo, because a person saw the text again.
 */
export const reportFumsToken = (token: string, path: string, cached: boolean) => {
  //In development, React runs each effect two times. Do not send the same view two times.
  const now = Date.now();
  const repeated = lastReport.token === token && now - lastReport.at < 1000;
  lastReport = { token, at: now };

  if (!repeated) {
    window.fums?.("trackView", token);
    //The ID of a report is the number of reports in the session
    const reported = state.reported + 1;
    setState({
      ...state,
      activeToken: token,
      reported,
      reports: [
        ...state.reports,
        { id: reported, token, path, cached, at: now },
      ].slice(-MAX_FUMS_REPORTS),
    });
  } else if (state.activeToken !== token) {
    setState({ ...state, activeToken: token });
  }
};

/** Records that the page with this token does not show now */
export const leaveFumsPage = (token: string) => {
  if (state.activeToken === token) {
    setState({ ...state, activeToken: null });
  }
};

/**
 * Records a request that the FUMS script sent. The browser gives the URL of the
 * request, which contains the tokens and the IDs that the script added.
 */
export const recordFumsRequest = (
  url: URL,
  status: number,
  durationMs: number,
) => {
  const tokens = url.searchParams.getAll("t");
  const request = {
    deviceId: url.searchParams.get("dId"),
    sessionId: url.searchParams.get("sId"),
    userId: url.searchParams.get("uId"),
    status,
    durationMs,
  };

  //A token of a report that dropped from the list matches no report, so it changes nothing
  let attached = 0;
  const reports = state.reports.map((report) => {
    //Attach the request to the oldest report of its token that has no request
    const index = report.request ? -1 : tokens.indexOf(report.token);
    if (index < 0) {
      return report;
    }
    tokens.splice(index, 1);
    attached += 1;
    return { ...report, request };
  });
  if (attached) {
    setState({ ...state, reports, sent: state.sent + attached });
  }
};
