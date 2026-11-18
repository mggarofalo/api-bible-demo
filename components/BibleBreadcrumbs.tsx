"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, ReactNode } from "react";
import { BiblePicker, useBibleNav } from "./BibleNav";
import { ReferencePicker } from "./ReferencePicker";

type BibleBreadcrumbsProps = {
  /** Shown on pages that are not part of a Bible */
  fallback: ReactNode;
};

//Names of the pages that list the contents of a Bible, book or chapter
const LIST_NAMES: Record<string, string> = {
  books: "Books",
  chapters: "Chapters",
  sections: "Sections",
  verses: "Verses",
};

/**
 * Shows the location of the current page in a Bible, for example
 * `Home > NASB1995 > Genesis 1:1-3`.
 *
 * The Bible and the reference are text that the user can click:
 *   - The Bible opens a list of all Bibles.
 *   - The reference opens a form to select a book, chapter, verse or range of verses.
 */
export const BibleBreadcrumbs = ({ fallback }: BibleBreadcrumbsProps) => {
  const nav = useBibleNav();
  const pathname = usePathname();

  if (!nav) {
    return fallback;
  }

  //The parts of the path after `/bibles/{bibleId}`
  const [area, id, list] = pathname.split("/").slice(3);

  const crumbs: ReactNode[] = [
    <Link key="home" href="/" prefetch={false} className="text-sm hover:underline">
      Home
    </Link>,
    <BiblePicker key="bible" />,
    <ReferencePicker key="reference" />,
  ];

  //Pages that are not one book, chapter, verse or passage show their name at the end
  let name: string | undefined;
  if (area === "search") {
    name = "Search";
  } else if (area === "sections" && id) {
    name = `Section ${decodeURIComponent(id)}`;
  } else {
    //List pages: `/books`, `/books/{bookId}/chapters`, `/chapters/{chapterId}/verses`, ...
    name = LIST_NAMES[list ?? (id ? "" : area)];
  }
  if (name) {
    crumbs.push(
      <p key="name" className="text-sm">
        {name}
      </p>,
    );
  }

  return (
    <nav
      aria-label="Location"
      className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mb-3"
    >
      {crumbs.map((crumb, index) => (
        <Fragment key={index}>
          {index > 0 && <ChevronRight size={12} className="shrink-0" />}
          {crumb}
        </Fragment>
      ))}
    </nav>
  );
};

//The placeholder name of the ID that follows each of these parts of a route
const ID_NAMES: Record<string, string> = {
  bibles: "bibleId",
  books: "bookId",
  chapters: "chapterId",
  verses: "verseId",
  passages: "passageId",
  sections: "sectionId",
};

/**
 * Shows the route of the API endpoint that the current page calls, as the main heading
 * of the page. The routes of this application agree with the routes of the API, so the
 * route comes from the URL of the page.
 *
 * Each ID in the route has its placeholder name below it, for example `{bibleId}`, to
 * show the syntax of the route: `/bibles/{bibleId}/verses/{verseId}`.
 */
export const RouteHero = () => {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  return (
    <h3
      aria-label={`GET ${pathname}`}
      className="flex flex-wrap items-start gap-y-2 font-mono text-xl sm:text-2xl font-bold leading-tight"
    >
      <span className="mr-3 mt-1 px-2 py-0.5 rounded text-sm text-accent bg-accent-soft border-accent/40 border-[1px]">
        GET
      </span>
      {parts.map((part, index) => {
        const idName = ID_NAMES[parts[index - 1]];
        //A part is an ID when the part before it is a collection, and it is in an odd position (`/bibles/{bibleId}/books/{bookId}`)
        const isId = !!idName && index % 2 === 1;

        return (
          <span key={index} className="flex items-start">
            <span className="text-zinc-400">/</span>
            {isId ? (
              <span className="flex flex-col">
                <span className="text-accent break-all">{part}</span>
                <span className="text-xs font-normal text-zinc-500">{`{${idName}}`}</span>
              </span>
            ) : (
              <span>{part}</span>
            )}
          </span>
        );
      })}
    </h3>
  );
};
