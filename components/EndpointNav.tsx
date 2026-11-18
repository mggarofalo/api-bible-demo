"use client";

import { getEndpoint } from "@/utils/apiReference";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useBibleLocation, useBibleNav } from "./BibleNav";

type TipProps = {
  /** Text of the help tip */
  tip: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Shows a help tip below its content when the pointer is on the content, or when the
 * content has the focus.
 */
export const Tip = ({ tip, children, className = "" }: TipProps) => (
  <span className={`group/tip relative ${className}`}>
    {children}
    <span
      role="tooltip"
      className="hidden group-hover/tip:block group-focus-within/tip:block absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 w-max max-w-[280px] px-2 py-1 rounded font-sans text-xs font-normal text-left whitespace-normal text-white bg-black shadow-lg"
    >
      {tip}
    </span>
  </span>
);

type EndpointLink = {
  label: string;
  href: string;
  /** Route of the API endpoint, with placeholders */
  route: string;
};

/**
 * Shows a link to each API endpoint that applies to the current location: the Bible,
 * and the book, chapter and verse of the page if it has them. Thus each endpoint of
 * the demo is one click away from each page. The link of the current page is dark.
 *
 * Each link has a help tip with its route and its summary from the API reference.
 */
export const EndpointNav = () => {
  const nav = useBibleNav();
  const location = useBibleLocation();
  const pathname = usePathname();

  if (!nav) {
    return null;
  }

  const base = `/bibles/${nav.bibleId}`;
  const book = nav.books.find(({ id }) => id === location.bookId);
  const chapterNumber = location.chapterId?.split(".")[1];
  const verseNumber = location.verseId?.split(".")[2];

  const rows: { name: string; links: EndpointLink[] }[] = [
    {
      name:
        nav.bibles.find(({ id }) => id === nav.bibleId)?.abbreviation || "Bible",
      links: [
        { label: "Bible", href: base, route: "/bibles/{bibleId}" },
        { label: "Books", href: `${base}/books`, route: "/bibles/{bibleId}/books" },
        { label: "Search", href: `${base}/search`, route: "/bibles/{bibleId}/search" },
      ],
    },
  ];

  if (book) {
    rows.push({
      name: book.name,
      links: [
        {
          label: "Book",
          href: `${base}/books/${book.id}`,
          route: "/bibles/{bibleId}/books/{bookId}",
        },
        {
          label: "Chapters",
          href: `${base}/books/${book.id}/chapters`,
          route: "/bibles/{bibleId}/books/{bookId}/chapters",
        },
        {
          label: "Sections",
          href: `${base}/books/${book.id}/sections`,
          route: "/bibles/{bibleId}/books/{bookId}/sections",
        },
      ],
    });
  }

  if (book && location.chapterId) {
    rows.push({
      name: `${book.name} ${chapterNumber}`,
      links: [
        {
          label: "Chapter",
          href: `${base}/chapters/${location.chapterId}`,
          route: "/bibles/{bibleId}/chapters/{chapterId}",
        },
        {
          label: "Verses",
          href: `${base}/chapters/${location.chapterId}/verses`,
          route: "/bibles/{bibleId}/chapters/{chapterId}/verses",
        },
        {
          label: "Sections",
          href: `${base}/chapters/${location.chapterId}/sections`,
          route: "/bibles/{bibleId}/chapters/{chapterId}/sections",
        },
      ],
    });
  }

  if (book && location.verseId) {
    rows.push({
      name: `${book.name} ${chapterNumber}:${verseNumber}`,
      links: [
        {
          label: "Verse",
          href: `${base}/verses/${location.verseId}`,
          route: "/bibles/{bibleId}/verses/{verseId}",
        },
        ...(location.endVerseId
          ? [
              {
                label: "Passage",
                href: `${base}/passages/${location.verseId}-${location.endVerseId}`,
                route: "/bibles/{bibleId}/passages/{passageId}",
              },
            ]
          : []),
      ],
    });
  }

  return (
    <nav
      aria-label="Endpoints for this location"
      className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm"
    >
      {rows.map((row) => (
        <div key={row.name} className="contents">
          <span className="text-zinc-500">{row.name}</span>
          <div className="flex flex-wrap gap-1.5">
            {row.links.map((link) => {
              const current = pathname === link.href;
              return (
                <Tip
                  key={link.href}
                  tip={
                    <>
                      <span className="block font-mono font-bold break-all">
                        {link.route}
                      </span>
                      {/* The summary of the endpoint in the API reference */}
                      {getEndpoint(link.route)?.summary}
                    </>
                  }
                >
                  <Link
                    href={link.href}
                    prefetch={false}
                    aria-current={current ? "page" : undefined}
                    className={`block px-2.5 py-0.5 rounded border-[1px] ${
                      current
                        ? "bg-accent text-white border-accent font-bold"
                        : "bg-accent-soft border-accent/40 hover:bg-accent hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                </Tip>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};
