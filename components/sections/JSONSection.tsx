import type { Exchange } from "@/utils/api";
import { FumsReporter } from "../FumsPanel";
import { ExpandableSection } from "./ExpandableSection";
import { JsonBodyLink, RAW_JSON_ID } from "./JsonBodyLink";

type JSONContentProps = {
  /** The JSON to show, normally the response body returned by `traced` */
  json: object;
  /** The HTTP request and response behind the JSON, shown in their own sections when given */
  exchange?: Exchange;
  /**
   * Whether the JSON starts expanded. Pages whose main content is the
   * JSON itself open it by default, everywhere else it starts collapsed.
   */
  defaultOpen?: boolean;
};

const Headers = ({ headers }: { headers: [string, string][] }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-sm">
    {headers.map(([name, value]) => (
      <div key={name} className="contents">
        <dt className="font-bold">{name}</dt>
        <dd className="break-all mb-1 sm:mb-0">{value}</dd>
      </div>
    ))}
  </dl>
);

const Label = ({ children }: { children: string }) => (
  <h6 className="mt-4 first:mt-0 mb-1 text-xs font-bold uppercase text-zinc-500">
    {children}
  </h6>
);

/**
 * Renders what went over the wire for an API call in expandable sections: the request,
 * the response, and the raw JSON body the response carried.
 *
 * If the response has a FUMS token (`meta.fumsToken`), this also reports the token to
 * FUMS when the page shows (see utils/fums.ts).
 */
export const JSONSection = ({
  json,
  exchange,
  defaultOpen = false,
}: JSONContentProps) => {
  const url = exchange ? new URL(exchange.request.url) : null;
  const query = url ? [...url.searchParams] : [];

  //Age of a response that came from the cache of the demo, as text
  const cachedSeconds = exchange?.response.cachedSecondsAgo;
  const cachedAge =
    cachedSeconds === undefined
      ? undefined
      : cachedSeconds < 90
        ? `${cachedSeconds} s ago`
        : cachedSeconds < 5400
          ? `${Math.round(cachedSeconds / 60)} min ago`
          : `${Math.round(cachedSeconds / 3600)} h ago`;

  //A response that contains Scripture has a FUMS token, which the page must report
  const fumsToken = (json as { meta?: { fumsToken?: string } }).meta?.fumsToken;

  return (
    <>
      <FumsReporter token={fumsToken} cached={cachedSeconds !== undefined} />
      {!!exchange && !!url && (
        //The `data-` attributes let a script read the request that the page made (see scripts/parity.mjs)
        <div
          className="contents"
          data-api-request={exchange.request.url}
          data-api-status={exchange.response.status}
        >
          <ExpandableSection
            title="Request"
            summary={
              <p className="truncate font-mono">
                {exchange.request.method} {url.pathname}
              </p>
            }
          >
            <Label>URL</Label>
            <p className="font-mono text-sm break-all">
              <b>{exchange.request.method}</b> {exchange.request.url}
            </p>
            {!!query.length && (
              <>
                <Label>Query Parameters</Label>
                <Headers headers={query} />
              </>
            )}
            <Label>Headers</Label>
            <Headers headers={exchange.request.headers} />
          </ExpandableSection>

          <ExpandableSection
            title="Response"
            summary={
              <p className="truncate font-mono">
                {exchange.response.status} {exchange.response.statusText} ·{" "}
                {cachedAge === undefined
                  ? `${exchange.response.durationMs} ms`
                  : `from the cache (${cachedAge})`}
              </p>
            }
          >
            <Label>Status</Label>
            <p className="font-mono text-sm">
              <b>{exchange.response.status}</b> {exchange.response.statusText}{" "}
              in {exchange.response.durationMs} ms
            </p>
            {cachedAge !== undefined && (
              <>
                <Label>Cache</Label>
                <p className="text-sm">
                  The demo got this response from the API {cachedAge}. It did
                  not call the API for this view.
                </p>
              </>
            )}
            <Label>Headers</Label>
            <Headers headers={exchange.response.headers} />
            <Label>Body</Label>
            <p className="text-sm">
              <JsonBodyLink />
            </p>
          </ExpandableSection>
        </div>
      )}

      <ExpandableSection
        title="Raw JSON Output"
        id={RAW_JSON_ID}
        defaultOpen={defaultOpen}
      >
        <pre className="text-wrap break-words">
          {JSON.stringify(json, null, 2)}
        </pre>
      </ExpandableSection>
    </>
  );
};
