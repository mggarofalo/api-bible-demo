"use client";

import { HELP_COLLAPSED_KEY } from "@/components/NavControls";
import { useStoredFlag } from "@/utils/useStoredFlag";
import { BookOpenText, Check, ChevronRight, Copy } from "lucide-react";
import { ReactNode, useState } from "react";

type InfoCardProps = {
  title: string;
  /** URL of the endpoint, with placeholders such as `{bibleId}` */
  url?: string;
  /**
   * URL of the API request that the page made. When given, the card shows this URL and
   * not `url`, so the URL agrees with the Bible, the reference and the query parameters
   * that the user selected.
   */
  requestUrl?: string;
  info: ReactNode;
};

/**
 * Renders a card that contains "help" text about the page. Click the title of the card
 * to collapse it to only the title, or to open it again.
 *
 * The `help-collapsed` value in the browser controls the help cards of all pages. The
 * stylesheet hides the text of a collapsed card (see globals.css), so the text does
 * not show for a moment while the page loads.
 */
export const InfoSection = ({
  title,
  info,
  url: templateUrl,
  requestUrl,
}: InfoCardProps) => {
  const url = requestUrl ?? templateUrl;
  const [collapsed, setCollapsed] = useStoredFlag(HELP_COLLAPSED_KEY);
  const [copied, setCopied] = useState(false);

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
          <h5 className="grow font-bold">{title}</h5>
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
          {info}
        </div>
      </div>
    </div>
  );
};
