"use client";

import type { SidebarBook } from "@/utils/getSidebarBooks";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useBibleLocation, useBibleNav } from "./BibleNav";

/**
 * A location in a Bible, as API.Bible IDs. An empty value means "none".
 *   - Only `book`: the full book
 *   - `book` and `chapter`: the full chapter
 *   - `book`, `chapter` and `verse`: one verse
 *   - With `toVerse`: the range of verses from `verse` to `toVerse` (a passage)
 */
type Reference = {
  book: string;
  chapter: string;
  verse: string;
  /** Chapter of the last verse. Empty when it is the same as `chapter`. */
  toChapter: string;
  toVerse: string;
};

//The text after the last dot, or all the text when it has no dot
const lastPart = (id: string) => id.slice(id.lastIndexOf(".") + 1);

/**
 * Gives the text of a reference (for example "Genesis 1:1-3") and the page of this
 * application that shows it. The path of the page agrees with the path of the API endpoint.
 */
const describe = (
  books: SidebarBook[],
  bibleId: string,
  { book, chapter, verse, toChapter, toVerse }: Reference,
) => {
  const base = `/bibles/${bibleId}`;
  const name = books.find(({ id }) => id === book)?.name;

  if (!name) {
    return { text: "", href: "" };
  }
  if (!chapter) {
    return { text: name, href: `${base}/books/${book}` };
  }
  const chapterText = `${name} ${lastPart(chapter)}`;
  if (!verse) {
    return { text: chapterText, href: `${base}/chapters/${chapter}` };
  }
  const verseText = `${chapterText}:${lastPart(verse)}`;
  if (!toVerse) {
    return { text: verseText, href: `${base}/verses/${verse}` };
  }
  const end =
    toChapter && toChapter !== chapter
      ? `${lastPart(toChapter)}:${lastPart(toVerse)}`
      : lastPart(toVerse);

  return {
    text: `${verseText}-${end}`,
    href: `${base}/passages/${verse}-${toVerse}`,
  };
};

type SelectProps = {
  label: string;
  value: string;
  /** Text of the option that has no value, for example "All". Without it, there is no such option. */
  none?: string;
  className?: string;
  options: { id: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

const Select = ({
  label,
  value,
  none,
  options,
  disabled,
  onChange,
  className = "",
}: SelectProps) => (
  //Each list is as wide as its widest option, and does not get narrower
  <span className={`relative shrink-0 ${className}`}>
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="appearance-none w-full pl-2 pr-7 py-1 text-sm font-bold bg-white border-line border-[1px] cursor-pointer hover:bg-accent-soft disabled:cursor-default disabled:text-zinc-400 disabled:border-zinc-300 disabled:hover:bg-white"
    >
      {none !== undefined && <option value="">{none}</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown
      size={14}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
    />
  </span>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  //The children are cells of the grid of the form, so the lists of the two rows align
  <>
    <span className="pr-1.5 text-xs font-bold uppercase text-zinc-500">
      {label}
    </span>
    {children}
  </>
);

/** Reads the reference of the current page from the URL */
const useCurrentReference = (): Reference => {
  const location = useBibleLocation();
  const endChapter = location.endVerseId?.split(".").slice(0, 2).join(".");

  return {
    book: location.bookId ?? "",
    chapter: location.chapterId ?? "",
    verse: location.verseId ?? "",
    toChapter: endChapter && endChapter !== location.chapterId ? endChapter : "",
    toVerse: location.endVerseId ?? "",
  };
};

type ReferencePanelProps = {
  /** Called when the user opens the selected reference */
  onOpen?: () => void;
};

/**
 * Form to select a reference: a start (book, chapter, verse) and an optional end
 * (chapter, verse). The "Open" button goes to the page of the selection.
 *
 * The form starts at the reference of the current page.
 */
export const ReferencePanel = ({ onOpen }: ReferencePanelProps) => {
  const nav = useBibleNav();
  const pathname = usePathname();
  const [draft, setDraft] = useState(useCurrentReference());

  const loadVerses = nav?.loadVerses;
  const endChapter = draft.toChapter || draft.chapter;

  //The verse lists show the verses of the selected chapters
  useEffect(() => {
    if (draft.chapter) {
      loadVerses?.(draft.chapter);
    }
    if (endChapter) {
      loadVerses?.(endChapter);
    }
  }, [draft.chapter, endChapter, loadVerses]);

  if (!nav) {
    return null;
  }

  const { books, verses, bibleId } = nav;
  //The chapters of the selection whose verses did not load
  const failed = [...new Set([draft.chapter, endChapter])].filter(
    (chapterId) => chapterId && verses[chapterId] === "error",
  );
  const chapters = books.find(({ id }) => id === draft.book)?.chapters ?? [];
  const versesOf = (chapterId: string) => {
    const loaded = verses[chapterId];
    return Array.isArray(loaded) ? loaded : [];
  };
  const startVerses = versesOf(draft.chapter);
  const startChapterIndex = chapters.findIndex(({ id }) => id === draft.chapter);
  const startVerseIndex = startVerses.findIndex(({ id }) => id === draft.verse);
  //The end of a range must be after its start
  const endVerses =
    endChapter === draft.chapter
      ? startVerses.slice(startVerseIndex + 1)
      : versesOf(endChapter);

  //A range to a later chapter must have an end verse. Until the user selects one, it is the last verse of that chapter.
  const toVerse =
    draft.toVerse || (draft.toChapter ? (endVerses.at(-1)?.id ?? "") : "");
  //The verses of the last chapter are not loaded yet
  const waiting = !!draft.toChapter && !toVerse;
  const target = waiting
    ? { text: "", href: "" }
    : describe(books, bibleId, { ...draft, toVerse });

  return (
    //Columns: row name, book, chapter, ":", verse. Each column is as wide as its widest list.
    <div className="grid grid-cols-[repeat(5,auto)] w-max max-w-full items-center gap-x-1.5 gap-y-2">
      <Row label="From">
        <Select
          label="Book"
          none="Book"
          value={draft.book}
          options={books.map(({ id, name }) => ({ id, label: name }))}
          onChange={(book) =>
            setDraft({ book, chapter: "", verse: "", toChapter: "", toVerse: "" })
          }
        />
        <Select
          label="Chapter"
          none="All"
          value={draft.chapter}
          disabled={!draft.book}
          options={chapters.map(({ id, number }) => ({ id, label: number }))}
          onChange={(chapter) =>
            setDraft({ ...draft, chapter, verse: "", toChapter: "", toVerse: "" })
          }
        />
        <span>:</span>
        <Select
          label="Verse"
          none="All"
          value={draft.verse}
          disabled={!startVerses.length}
          options={startVerses.map(({ id, number }) => ({ id, label: number }))}
          onChange={(verse) =>
            setDraft({ ...draft, verse, toChapter: "", toVerse: "" })
          }
        />
      </Row>
      <Row label="To">
        {/* The range stays in one book, so the book column is empty */}
        <span />
        <Select
          label="Last chapter"
          none="Same"
          value={draft.toChapter}
          disabled={!draft.verse}
          options={chapters
            .slice(startChapterIndex + 1)
            .map(({ id, number }) => ({ id, label: number }))}
          onChange={(toChapter) => setDraft({ ...draft, toChapter, toVerse: "" })}
        />
        <span>:</span>
        <Select
          label="Last verse"
          //"None" is not possible when the range ends in a later chapter
          none={draft.toChapter ? undefined : "None"}
          value={toVerse}
          disabled={!draft.verse || !endVerses.length}
          options={endVerses.map(({ id, number }) => ({ id, label: number }))}
          onChange={(toVerse) => setDraft({ ...draft, toVerse })}
        />
      </Row>

      {/* `w-0 min-w-full`: this row takes the width of the lists above. The long path wraps, and does not make the form wider. */}
      <div className="col-span-5 w-0 min-w-full flex flex-wrap items-center gap-3 pt-2 mt-1 border-zinc-200 border-t-[1px]">
        {target.href && target.href !== pathname ? (
          <Link
            href={target.href}
            prefetch={false}
            onClick={onOpen}
            className="px-4 py-1 rounded text-sm font-bold bg-accent-soft border-accent border-[1px] hover:bg-accent hover:text-white"
          >
            Open
          </Link>
        ) : (
          <span className="px-4 py-1 rounded text-sm font-bold text-zinc-400 border-zinc-300 border-[1px]">
            Open
          </span>
        )}
        <code className="min-w-0 text-xs text-zinc-500 break-all">
          {target.href ||
            (failed.length
              ? "The verses did not load."
              : waiting
                ? "Wait for the verses."
                : "Select a book.")}
        </code>
        {failed.length > 0 && (
          <button
            type="button"
            onClick={() => failed.forEach(nav.loadVerses)}
            className="text-xs underline cursor-pointer hover:text-accent"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Shows the reference of the current page as text, for example "Genesis 1:1-3". Click
 * the text to open a form that selects a different book, chapter, verse or range of verses.
 */
export const ReferencePicker = () => {
  const nav = useBibleNav();
  const pathname = usePathname();
  const current = useCurrentReference();
  //The form closes on a new page, because it is open only for the path where it opened
  const [openPath, setOpenPath] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const open = openPath === pathname;

  //Close the form when the user clicks out of it or pushes Escape
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpenPath(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!nav) {
    return null;
  }

  const text = describe(nav.books, nav.bibleId, current).text;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={text ? `Reference: ${text}` : "Select a reference"}
        onClick={() => setOpenPath(open ? null : pathname)}
        className="flex items-center gap-1 text-sm font-bold cursor-pointer border-b-[1px] border-dashed border-transparent hover:border-line"
      >
        {text || "Select a reference"}
        <ChevronsUpDown size={12} className="shrink-0 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-[calc(100%+4px)] w-max max-w-[92vw] overflow-x-auto p-3 bg-white border-line border-[1px] rounded-md shadow-lg">
          <ReferencePanel onOpen={() => setOpenPath(null)} />
        </div>
      )}
    </div>
  );
};
