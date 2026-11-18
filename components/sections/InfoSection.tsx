"use client";

import { useStoredFlag } from "@/utils/useStoredFlag";
import { BookOpenText, Check, ChevronRight, Copy } from "lucide-react";
import { ReactNode, useState } from "react";

type InfoCardProps = {
  title: string;
  url?: string;
  info: ReactNode;
};

/**
 * Renders a card that contains "help" text about the page.
 *
 * The card starts closed and shows only its title. The user clicks the title to open
 * or close it. The browser keeps this selection, so the cards on all pages open and
 * close together.
 */
export const InfoSection = ({ title, info, url }: InfoCardProps) => {
  const [open, setOpen] = useStoredFlag("info-section-open");
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
    <div className="bg-black text-white w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left cursor-pointer hover:bg-zinc-800"
      >
        <BookOpenText size={16} className="shrink-0 mr-2" />
        <h5 className="font-bold grow">{title}</h5>
        <ChevronRight
          size={16}
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="pl-[48px] pr-4 pt-2 pb-8 flex flex-col gap-1">
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
              <code className="mb-2 font-bold text-zinc-400 break-all">
                {url}
              </code>
            </div>
          )}
          {info}
        </div>
      )}
    </div>
  );
};
