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

type EndpointPathProps = {
  /** Shown on pages that are not part of a Bible */
  fallback: string;
};

/**
 * Shows the path of the API endpoint that the current page calls. The paths of this
 * application agree with the paths of the API, so the path comes from the URL of the page.
 */
export const EndpointPath = ({ fallback }: EndpointPathProps) => {
  const nav = useBibleNav();
  const pathname = usePathname();

  if (!nav) {
    return <p className="text-zinc-500">{fallback}</p>;
  }

  return (
    <p className="font-mono text-sm text-zinc-500 break-all">{pathname}</p>
  );
};
