"use client";

import type { SidebarBook } from "@/utils/getSidebarBooks";
import { useParams, useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { SELECTED_BIBLE_IDS } from "@/utils/bibleScope";
import { BibleScopeSwitch, useBibleScope } from "./BibleScope";
import { Combobox } from "./Combobox";

export type NavBible = {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
};
export type NavVerse = { id: string; number: string };

type BibleNav = {
  bibleId: string;
  bibles: NavBible[];
  books: SidebarBook[];
  /** Verses of each chapter that was loaded, or "error" if the load failed */
  verses: Record<string, NavVerse[] | "error">;
  /** Gets the verses of a chapter, if they are not loaded already */
  loadVerses: (chapterId: string) => void;
};

const BibleNavContext = createContext<BibleNav | null>(null);

/**
 * Returns the data used to move through the current Bible, or `null` on pages
 * that are not part of a Bible.
 */
export const useBibleNav = () => useContext(BibleNavContext);

type BibleNavProviderProps = Pick<BibleNav, "bibleId" | "bibles" | "books"> & {
  children: ReactNode;
};

/**
 * Gives the sidebar and the header lists the same data: the Bibles, the books and
 * chapters of the current Bible, and the verses of each chapter that was opened.
 *
 * The server supplies the Bibles, books and chapters. The verses come from this
 * application's `/api/bibles/{bibleId}/chapters/{chapterId}/verses` route, one chapter
 * at a time, because the browser must not call API.Bible directly (the API key
 * would be visible).
 */
export const BibleNavProvider = ({
  bibleId,
  bibles,
  books,
  children,
}: BibleNavProviderProps) => {
  const [verses, setVerses] = useState<BibleNav["verses"]>({});
  const requested = useRef(new Set<string>());

  const loadVerses = useCallback(
    (chapterId: string) => {
      if (requested.current.has(chapterId)) {
        return;
      }
      requested.current.add(chapterId);

      fetch(`/api/bibles/${bibleId}/chapters/${chapterId}/verses`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          return response.json() as Promise<NavVerse[]>;
        })
        .then((data) => setVerses((all) => ({ ...all, [chapterId]: data })))
        .catch(() => {
          //Let the next call try again
          requested.current.delete(chapterId);
          setVerses((all) => ({ ...all, [chapterId]: "error" }));
        });
    },
    [bibleId],
  );

  const value = useMemo(
    () => ({ bibleId, bibles, books, verses, loadVerses }),
    [bibleId, bibles, books, verses, loadVerses],
  );

  return (
    <BibleNavContext.Provider value={value}>
      {children}
    </BibleNavContext.Provider>
  );
};

type Params = Record<string, string | string[] | undefined>;

const param = (params: Params, name: string) => {
  const value = params[name];
  const single = Array.isArray(value) ? value[0] : value;
  return single ? decodeURIComponent(single) : undefined;
};

/**
 * Finds the book, chapter and verse of the current page from the IDs in the URL.
 * API.Bible IDs contain the IDs of their parents (`GEN` > `GEN.1` > `GEN.1.1`).
 */
export const useBibleLocation = () => {
  const params = useParams() as Params;
  const sectionId = param(params, "sectionId");
  //A passage is a range (`GEN.1.1-GEN.1.3`). Its location is the start of the range.
  const [passageStart, passageEnd] = (param(params, "passageId") ?? "").split(
    "-",
  );
  const id =
    param(params, "verseId") ??
    param(params, "chapterId") ??
    (passageStart || undefined) ??
    sectionId ??
    param(params, "bookId");

  if (!id) {
    return {};
  }

  const parts = id.split(".");
  //A section ID (`GEN.S1`) contains a book, but not a chapter
  const hasChapter = parts.length > 1 && !sectionId;

  return {
    bookId: parts[0],
    chapterId: hasChapter ? `${parts[0]}.${parts[1]}` : undefined,
    verseId: hasChapter && parts.length > 2 ? id : undefined,
    /** Last verse of the range, on a passage page */
    endVerseId: passageEnd || undefined,
  };
};

export const chapterName = (number: string) =>
  number === "intro" ? "Introduction" : `Chapter ${number}`;

/**
 * Returns the Bibles for the lists of the demo: the short list or all Bibles, as the
 * Bible scope says (see utils/bibleScope.ts). The current Bible is always in the list.
 */
export const useScopedBibles = () => {
  const nav = useBibleNav();
  const [scope] = useBibleScope();

  if (!nav) {
    return [];
  }
  return scope === "all"
    ? nav.bibles
    : nav.bibles.filter(
        ({ id }) => SELECTED_BIBLE_IDS.includes(id) || id === nav.bibleId,
      );
};

/**
 * Drop-down list of Bibles. Shows the abbreviation of the current Bible as text.
 * Opens the page of the Bible that the user selects. On top of the list are a switch
 * between the short list and all Bibles, and a link to the Bibles page.
 */
export const BiblePicker = () => {
  const nav = useBibleNav();
  const bibles = useScopedBibles();
  const router = useRouter();

  if (!nav) {
    return null;
  }

  return (
    <Combobox
      label="Bible"
      value={nav.bibleId}
      selectedText={
        nav.bibles.find(({ id }) => id === nav.bibleId)?.abbreviation
      }
      options={bibles.map((bible) => ({
        id: bible.id,
        label: bible.name,
        detail: `${bible.abbreviation} · ${bible.language}`,
      }))}
      onSelect={(id) => router.push(`/bibles/${id}`)}
      header={
        <>
          Bibles in the list
          <BibleScopeSwitch />
        </>
      }
      action={{
        label: "Open the Bibles page",
        onSelect: () => router.push("/bibles"),
      }}
      emptyText="No Bible has this text."
    />
  );
};
