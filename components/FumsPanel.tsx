"use client";

import {
  FUMS_DEMO_USER_ID,
  FUMS_DOCS_URL,
  FUMS_SERVER,
  fumsStore,
  leaveFumsPage,
  recordFumsRequest,
  reportFumsToken,
} from "@/utils/fums";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader,
  SquareArrowOutUpRight,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";

type FumsReporterProps = {
  /** The `meta.fumsToken` of the API response that the page shows */
  token?: string;
  /** The response came from the cache of the demo, so the token was reported before */
  cached?: boolean;
};

/**
 * Reports the FUMS token of a page each time the page shows. It has no content of its own.
 */
export const FumsReporter = ({ token, cached = false }: FumsReporterProps) => {
  const pathname = usePathname();

  useEffect(() => {
    if (!token) {
      return;
    }
    reportFumsToken(token, pathname, cached);
    return () => leaveFumsPage(token);
  }, [token, pathname, cached]);

  return null;
};

/** Tells if the browser sent this request to the FUMS server */
const isFumsRequest = (url: string) => {
  try {
    return new URL(url).origin === FUMS_SERVER;
  } catch {
    return false;
  }
};

const short = (value: string | null | undefined) =>
  !value ? "none" : value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

const Step = ({
  done,
  title,
  children,
}: {
  done: boolean;
  title: string;
  children: ReactNode;
}) => (
  <li className="flex gap-2">
    <span className="mt-0.5 shrink-0">
      {done ? (
        <Check size={12} className="text-accent" aria-hidden="true" />
      ) : (
        <Loader size={12} className="animate-spin text-zinc-400" aria-hidden="true" />
      )}
      {/* The icon is the only visible sign of the state. This text gives the state to a screen reader. */}
      <span className="sr-only">{done ? "Done:" : "In progress:"}</span>
    </span>
    <span className="min-w-0">
      <span className="block font-bold">{title}</span>
      <span className="block text-zinc-500 break-all">{children}</span>
    </span>
  </li>
);

/**
 * Small panel at the bottom right of the window that shows the FUMS activity.
 *
 * On a page that contains Scripture, the panel is open and shows the steps of the
 * report for that page: the token, the call to the FUMS script, the IDs that the script
 * added, and the request to the FUMS server. On other pages, it is one line with the
 * number of reports. Click the title to open or close it.
 *
 * The panel does not send the reports and does not change the FUMS script. It reads
 * the list of network requests that the browser keeps, to show what the script sent.
 */
export const FumsPanel = () => {
  const pathname = usePathname();
  const { reports, activeToken } = useSyncExternalStore(
    fumsStore.subscribe,
    fumsStore.getSnapshot,
    fumsStore.getServerSnapshot,
  );
  //The selection of the user for the current page. A new page starts with the default again.
  const [toggled, setToggled] = useState<{ path: string; open: boolean } | null>(
    null,
  );

  //Read the requests to the FUMS server from the list of requests that the browser keeps
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") {
      return;
    }
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (isFumsRequest(entry.name)) {
          const resource = entry as PerformanceResourceTiming;
          recordFumsRequest(
            new URL(entry.name),
            resource.responseStatus ?? 0,
            Math.round(entry.duration),
          );
        }
      }
    });
    observer.observe({ type: "resource", buffered: true });
    return () => observer.disconnect();
  }, []);

  const report =
    [...reports].reverse().find(({ token }) => token === activeToken) ??
    reports.at(-1);
  const open =
    toggled?.path === pathname ? toggled.open : !!activeToken && !!report;
  const request = report?.request;
  //The store keeps only the newest reports. The ID of the newest is the count of the session.
  const count = reports.at(-1)?.id ?? 0;

  return (
    <aside
      aria-label="FUMS activity"
      className="fixed bottom-4 right-4 z-30 w-[250px] max-w-[calc(100vw-2rem)] text-xs bg-white border-line border-[1px] rounded-md shadow-lg"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setToggled({ path: pathname, open: !open })}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer rounded-md hover:bg-accent-soft"
      >
        <span>
          <b>FUMS</b>
          <span className="ml-2 text-zinc-500">
            {count} {count === 1 ? "report" : "reports"}
          </span>
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-line border-t-[1px]">
          {report ? (
            <ol className="flex flex-col gap-2">
              <Step done title="1. The API gave a token">
                <code>meta.fumsToken</code> = {short(report.token)}
                {report.cached && (
                  <>
                    <br />
                    From a response in the cache. Each view is a report.
                  </>
                )}
              </Step>
              <Step done title="2. The page called the FUMS script">
                <code>fums(&quot;trackView&quot;, token)</code>
              </Step>
              <Step done={!!request} title="3. The script added the IDs">
                {request ? (
                  <>
                    Device <code>dId</code> = {short(request.deviceId)}
                    <br />
                    Session <code>sId</code> = {short(request.sessionId)}
                    <br />
                    User <code>uId</code> = {short(request.userId)}
                    <br />
                    (SHA-256 hash of &quot;{FUMS_DEMO_USER_ID}&quot;)
                  </>
                ) : (
                  "Wait for the script."
                )}
              </Step>
              <Step done={!!request} title="4. The script sent the report">
                {request ? (
                  <>
                    <code>GET fums.api.bible/f3</code>
                    <br />
                    {request.status ? `Status ${request.status}` : "Sent"} in{" "}
                    {request.durationMs} ms
                  </>
                ) : (
                  "Wait for the request."
                )}
              </Step>
            </ol>
          ) : (
            <p className="text-zinc-500">
              No report yet. A page that contains Scripture sends a report.
            </p>
          )}
          <a
            href={FUMS_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-3 underline text-accent"
          >
            FUMS documentation
            <SquareArrowOutUpRight size={10} />
          </a>
        </div>
      )}
    </aside>
  );
};
