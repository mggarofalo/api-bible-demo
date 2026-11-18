"use client";

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
      className="hidden group-hover/tip:block group-focus-within/tip:block absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 w-max max-w-[260px] px-2 py-1 rounded font-sans text-xs font-normal text-left whitespace-normal text-white bg-black shadow-lg"
    >
      {tip}
    </span>
  </span>
);

/**
 * What each part of the Bible is in the API, and how its ID is made. The words are the
 * collection names in the routes of the API.
 */
export const RESOURCE_TIPS: Record<string, string> = {
  bibles:
    "A Bible is one translation or version, for example the King James Version.",
  books:
    "A book is one book of a Bible, for example Genesis. A book ID has three letters: GEN.",
  chapters:
    "A chapter is one chapter of a book. A chapter ID is the book ID and the chapter number: GEN.1.",
  verses:
    "A verse is one verse of a chapter. A verse ID is the chapter ID and the verse number: GEN.1.1.",
  passages:
    "A passage is a range of verses that you select. A passage ID is the first verse ID and the last verse ID: GEN.1.1-GEN.1.3.",
  sections:
    "A section is a group of verses below one heading. The publisher of the Bible sets the sections. Some Bibles have no sections.",
  search: "A search finds the verses that contain your words.",
};

type EndpointLink = {
  label: string;
  href: string;
  /** Route of the API endpoint, with placeholders */
  route: string;
  tip: string;
};

/**
 * Shows a link to each API endpoint that applies to the current location: the Bible,
 * and the book, chapter and verse of the page if it has them. Thus each endpoint of
 * the demo is one click away from each page. The link of the current page is dark.
 *
 * Each link has a help tip that gives its route and tells what the endpoint gives.
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
        {
          label: "Bible",
          href: base,
          route: "/bibles/{bibleId}",
          tip: "The data of this Bible: its name, language and copyright.",
        },
        {
          label: "Books",
          href: `${base}/books`,
          route: "/bibles/{bibleId}/books",
          tip: "The list of the books in this Bible.",
        },
        {
          label: "Search",
          href: `${base}/search`,
          route: "/bibles/{bibleId}/search",
          tip: RESOURCE_TIPS.search,
        },
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
          tip: RESOURCE_TIPS.books,
        },
        {
          label: "Chapters",
          href: `${base}/books/${book.id}/chapters`,
          route: "/bibles/{bibleId}/books/{bookId}/chapters",
          tip: "The list of the chapters in this book.",
        },
        {
          label: "Sections",
          href: `${base}/books/${book.id}/sections`,
          route: "/bibles/{bibleId}/books/{bookId}/sections",
          tip: `The list of the sections in this book. ${RESOURCE_TIPS.sections}`,
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
          tip: `The text of this chapter. ${RESOURCE_TIPS.chapters}`,
        },
        {
          label: "Verses",
          href: `${base}/chapters/${location.chapterId}/verses`,
          route: "/bibles/{bibleId}/chapters/{chapterId}/verses",
          tip: "The list of the verses in this chapter.",
        },
        {
          label: "Sections",
          href: `${base}/chapters/${location.chapterId}/sections`,
          route: "/bibles/{bibleId}/chapters/{chapterId}/sections",
          tip: `The list of the sections in this chapter. ${RESOURCE_TIPS.sections}`,
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
          tip: `The text of this verse. ${RESOURCE_TIPS.verses}`,
        },
        ...(location.endVerseId
          ? [
              {
                label: "Passage",
                href: `${base}/passages/${location.verseId}-${location.endVerseId}`,
                route: "/bibles/{bibleId}/passages/{passageId}",
                tip: `The text of this range of verses. ${RESOURCE_TIPS.passages}`,
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
                      {link.tip}
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
