"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, ReactNode } from "react";
import { BiblePicker, useBibleNav } from "./BibleNav";
import { RESOURCE_TIPS, Tip } from "./EndpointNav";
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
 * Each word and each ID in the route has a dotted line below it. Move the pointer onto
 * one (or give it the focus) to see a help tip:
 *   - A word, for example `verses`: what that part of the Bible is, and how its ID is made.
 *   - An ID: its placeholder name, for example `{verseId}`. This shows the syntax of
 *     the route: `/bibles/{bibleId}/verses/{verseId}`.
 */
export const RouteHero = () => {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const tipClass =
    "break-all cursor-help outline-none border-b-[1px] border-dotted border-current";

  return (
    <h3
      aria-label={`GET ${pathname}`}
      className="flex flex-wrap items-baseline font-mono text-base sm:text-lg font-bold"
    >
      <span className="mr-2">GET</span>
      {parts.map((part, index) => {
        const idName = ID_NAMES[parts[index - 1]];
        //A part is an ID when the part before it is a collection, and it is in an odd position (`/bibles/{bibleId}/books/{bookId}`)
        const isId = !!idName && index % 2 === 1;
        const tip = isId ? `{${idName}}` : RESOURCE_TIPS[part];

        return (
          <span key={index} className="flex items-baseline">
            /
            {tip ? (
              <Tip tip={tip}>
                <span tabIndex={0} className={tipClass}>
                  {part}
                </span>
              </Tip>
            ) : (
              part
            )}
          </span>
        );
      })}
    </h3>
  );
};
