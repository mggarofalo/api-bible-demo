"use client";

import { ChevronRight, ChevronsLeft, ChevronsRight, Pin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoredFlag } from "@/utils/useStoredFlag";
import { useEffect, useRef, useState } from "react";
import {
  chapterName,
  useBibleLocation,
  useBibleNav,
} from "./BibleNav";

//Time the pointer can be off the sidebar before the sidebar closes
const CLOSE_DELAY_MS = 250;

/**
 * Sidebar that shows the books, chapters and verses of a Bible.
 *
 * The button at the top left of the window controls the sidebar:
 *   - Move the pointer onto the button to open the sidebar. It closes when the pointer moves away.
 *   - Click the button to keep the sidebar open (pinned). Click again to close it.
 *     The browser keeps this setting. A pinned sidebar moves the page to the right.
 *
 * The server supplies the books and chapters. The verses of a chapter load when the
 * chapter opens. The book and chapter of the current page start open.
 */
export const BibleSidebar = () => {
  const nav = useBibleNav();
  const pathname = usePathname();
  const current = useBibleLocation();
  const [pinned, setPinned] = useStoredFlag("bible-sidebar-pinned");
  const [hovered, setHovered] = useState(false);
  //Open/close selections of the user. These have priority over the defaults.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activeRow = useRef<HTMLDivElement>(null);

  const open = pinned || hovered;
  const loadVerses = nav?.loadVerses;

  //The current chapter starts open, so its verses are necessary immediately
  useEffect(() => {
    if (current.chapterId) {
      loadVerses?.(current.chapterId);
    }
  }, [current.chapterId, loadVerses]);

  //Keep the current location in view. The sidebar scrolls independently of the page.
  useEffect(() => {
    if (open) {
      activeRow.current?.scrollIntoView({ block: "nearest" });
    }
  }, [open, current.bookId, current.chapterId]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  //A pinned sidebar moves the page to the right (see globals.css), so the page stays in the center of the free space
  useEffect(() => {
    document.body.classList.toggle("sidebar-pinned", pinned);
    return () => document.body.classList.remove("sidebar-pinned");
  }, [pinned]);

  if (!nav) {
    return null;
  }
  const { bibleId, books, verses } = nav;

  const onPointerEnter = () => {
    clearTimeout(closeTimer.current);
    setHovered(true);
  };
  const onPointerLeave = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  };

  const isOpen = (id: string) =>
    toggled[id] ?? (id === current.bookId || id === current.chapterId);

  const toggle = (id: string, isChapter: boolean) => {
    const next = !isOpen(id);
    setToggled((all) => ({ ...all, [id]: next }));
    if (next && isChapter) {
      nav.loadVerses(id);
    }
  };

  const rowClass = (href: string, inPath: boolean) =>
    pathname === href
      ? "bg-[#2563eb] text-white"
      : inPath
        ? "bg-[#f1f7fe] font-bold"
        : "hover:bg-zinc-100";

  const buttonLabel = pinned
    ? "Close the sidebar"
    : open
      ? "Keep the sidebar open"
      : "Open the sidebar";

  return (
    <div onMouseEnter={onPointerEnter} onMouseLeave={onPointerLeave}>
      <button
        type="button"
        aria-label={buttonLabel}
        aria-expanded={open}
        title={buttonLabel}
        onClick={() => {
          setPinned(!pinned);
          //When the user removes the pin, close the sidebar immediately
          setHovered(false);
        }}
        className="fixed top-[76px] min-[900px]:top-2 left-0 min-[900px]:left-2 z-50 flex items-center justify-center w-8 h-8 bg-black text-white border-white border-[1px] cursor-pointer hover:bg-[#2563eb]"
      >
        {pinned ? (
          <ChevronsLeft size={18} />
        ) : open ? (
          <Pin size={16} />
        ) : (
          <ChevronsRight size={18} />
        )}
      </button>

      {open && (
        <aside
          aria-label="Books, chapters and verses"
          className="fixed top-0 bottom-0 left-0 z-40 flex flex-col w-[280px] max-w-[85vw] bg-white border-black border-r-[1px] shadow-xl"
        >
          <div className="flex items-center pl-14 pr-4 min-h-12 border-black border-b-[1px] max-[899px]:pl-4">
            <Link
              href={`/bibles/${bibleId}/books`}
              prefetch={false}
              className="text-sm font-bold hover:underline"
            >
              Books
            </Link>
          </div>

          <nav className="grow overflow-y-auto text-sm">
            {books.map((book) => {
              const bookHref = `/bibles/${bibleId}/books/${book.id}`;
              const bookOpen = isOpen(book.id);
              const isCurrentBook = book.id === current.bookId;

              return (
                <div key={book.id} className="border-zinc-200 border-b-[1px]">
                  <div
                    ref={
                      isCurrentBook && !current.chapterId
                        ? activeRow
                        : undefined
                    }
                    className={`flex items-stretch ${rowClass(bookHref, isCurrentBook)}`}
                  >
                    <button
                      type="button"
                      aria-expanded={bookOpen}
                      aria-label={`${bookOpen ? "Hide" : "Show"} the chapters of ${book.name}`}
                      onClick={() => toggle(book.id, false)}
                      className="px-2 cursor-pointer"
                    >
                      <ChevronRight
                        size={16}
                        className={`transition-transform ${bookOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                    <Link
                      href={bookHref}
                      prefetch={false}
                      className="grow py-2 pr-3"
                    >
                      {book.name}
                    </Link>
                  </div>

                  {bookOpen &&
                    book.chapters.map((chapter) => {
                      const chapterHref = `/bibles/${bibleId}/chapters/${chapter.id}`;
                      const chapterOpen = isOpen(chapter.id);
                      const isCurrentChapter = chapter.id === current.chapterId;
                      const chapterVerses = verses[chapter.id];
                      const name = chapterName(chapter.number);

                      return (
                        <div key={chapter.id}>
                          <div
                            ref={isCurrentChapter ? activeRow : undefined}
                            className={`flex items-stretch pl-4 ${rowClass(chapterHref, isCurrentChapter)}`}
                          >
                            <button
                              type="button"
                              aria-expanded={chapterOpen}
                              aria-label={`${chapterOpen ? "Hide" : "Show"} the verses of ${book.name}, ${name}`}
                              onClick={() => toggle(chapter.id, true)}
                              className="px-2 cursor-pointer"
                            >
                              <ChevronRight
                                size={14}
                                className={`transition-transform ${chapterOpen ? "rotate-90" : ""}`}
                              />
                            </button>
                            <Link
                              href={chapterHref}
                              prefetch={false}
                              className="grow py-1.5 pr-3"
                            >
                              {name}
                            </Link>
                          </div>

                          {chapterOpen && (
                            <div className="pl-12 pr-3 py-2">
                              {!chapterVerses && (
                                <p className="text-xs text-zinc-500">
                                  Wait for the verses.
                                </p>
                              )}
                              {chapterVerses === "error" && (
                                <p className="text-xs text-zinc-500">
                                  The verses did not load.
                                </p>
                              )}
                              {Array.isArray(chapterVerses) &&
                                !chapterVerses.length && (
                                  <p className="text-xs text-zinc-500">
                                    This chapter has no verses.
                                  </p>
                                )}
                              {Array.isArray(chapterVerses) &&
                                !!chapterVerses.length && (
                                  <div className="grid grid-cols-6 gap-1">
                                    {chapterVerses.map((verse) => (
                                      <Link
                                        key={verse.id}
                                        href={`/bibles/${bibleId}/verses/${verse.id}`}
                                        prefetch={false}
                                        title={verse.id}
                                        className={`py-1 text-xs text-center border-[1px] ${
                                          verse.id === current.verseId
                                            ? "bg-[#2563eb] text-white border-[#2563eb]"
                                            : "border-zinc-300 hover:bg-[#2563eb] hover:text-white hover:border-[#2563eb]"
                                        }`}
                                      >
                                        {verse.number}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </nav>
        </aside>
      )}
    </div>
  );
};
