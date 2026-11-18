"use client";

import { Markdown } from "@/components/Markdown";
import { HELP_COLLAPSED_KEY } from "@/components/NavControls";
import { findEndpoint } from "@/utils/apiReference";
import { useStoredFlag } from "@/utils/useStoredFlag";
import { BookOpenText, Check, ChevronRight, Copy } from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

type InfoCardProps = {
  /**
   * URL of the API request that the page made. The card shows this URL, so the URL
   * agrees with the Bible, the reference and the query parameters that the user selected.
   * Without it, the card shows the URL of the endpoint with placeholders.
   */
  requestUrl?: string;
  /** Title and text for a page that is not an endpoint of the API, such as the home page */
  title?: string;
  url?: string;
  info?: ReactNode;
};

/**
 * Renders a card that contains "help" text about the page. Click the title of the card
 * to collapse it to only the title, or to open it again.
 *
 * On a page that shows an API endpoint, the title and the text come from the API
 * reference: the summary and the description of the endpoint with the same path as the
 * page. The words are those of the reference, with no changes.
 *
 * The `help-collapsed` value in the browser controls the help cards of all pages. The
 * stylesheet hides the text of a collapsed card (see globals.css), so the text does
 * not show for a moment while the page loads.
 */
export const InfoSection = ({
  requestUrl,
  title,
  url: givenUrl,
  info,
}: InfoCardProps) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useStoredFlag(HELP_COLLAPSED_KEY);
  const [copied, setCopied] = useState(false);

  //Without a title, the card shows the endpoint of the API reference for this page
  const found = title ? undefined : findEndpoint(pathname);
  const heading = title ?? found?.endpoint.summary;
  const url =
    requestUrl ??
    givenUrl ??
    (found ? `https://rest.api.bible/v1${found.path}` : undefined);
  const body =
    info ??
    (found?.endpoint.description ? (
      <Markdown text={found.endpoint.description} />
    ) : null);

  if (!heading) {
    return null;
  }

  const onToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    //The stylesheet reads this attribute
    document.documentElement.dataset.help = next ? "collapsed" : "shown";
  };

  const onUrlCopy = async () => {
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  return (
    <div className="w-full px-4 py-3 border-line border-b-[1px]">
      <div className="rounded-md bg-accent-soft border-accent/25 border-[1px]">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-4 py-2 text-left cursor-pointer rounded-md hover:bg-accent/10"
        >
          <BookOpenText size={16} className="shrink-0 mr-2 text-accent" />
          <h5 className="grow font-bold">{heading}</h5>
          <ChevronRight
            size={16}
            className="help-chevron shrink-0 rotate-90 transition-transform"
          />
        </button>
        <div className="help-body pl-[48px] pr-4 pb-4 flex flex-col gap-1">
          {!!url && (
            <div className="w-full flex gap-2 overflow-hidden">
              <div className="w-[16px] mt-[5px]" title="Copy the URL">
                {copied ? (
                  <Check size={16} />
                ) : (
                  <Copy
                    size={16}
                    className="cursor-pointer"
                    onClick={onUrlCopy}
                  />
                )}
              </div>
              <code className="mb-2 font-bold text-zinc-600 break-all">
                {url}
              </code>
            </div>
          )}
          {body}
        </div>
      </div>
    </div>
  );
};
