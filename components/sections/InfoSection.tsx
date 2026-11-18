"use client";

import { HELP_COLLAPSED_KEY } from "@/components/NavControls";
import { useStoredFlag } from "@/utils/useStoredFlag";
import { BookOpenText, Check, Copy, X } from "lucide-react";
import { ReactNode, useState } from "react";

type InfoCardProps = {
  title: string;
  url?: string;
  info: ReactNode;
};

/**
 * Renders a card that contains "help" text about the page.
 *
 * The `help-collapsed` value in the browser controls the help cards of all pages. The
 * user changes it with the close button of a card, or with the Help button in the nav
 * bar. When the value is `true`, the stylesheet hides the cards (see globals.css), so
 * a closed card does not show for a moment while the page loads.
 */
export const InfoSection = ({ title, info, url }: InfoCardProps) => {
  const [, setCollapsed] = useStoredFlag(HELP_COLLAPSED_KEY);
  const [copied, setCopied] = useState(false);
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
    <div className="help-block w-full px-4 py-4 border-line border-b-[1px]">
      <div className="flex gap-2 px-4 py-4 rounded-md bg-accent-soft border-accent/25 border-[1px]">
        <div className="w-[16px] mr-2 shrink-0 text-accent">
          <BookOpenText size={16} className="mt-[5px]" />
        </div>
        <div className="grow min-w-0 flex flex-col gap-1">
          <h5 className="font-bold">{title}</h5>
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
        <button
          type="button"
          aria-label="Hide the help"
          title="Hide the help"
          onClick={() => setCollapsed(true)}
          className="self-start shrink-0 p-1 text-zinc-500 cursor-pointer hover:text-black hover:bg-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
