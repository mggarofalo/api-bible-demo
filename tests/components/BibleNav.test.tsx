import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BibleNavProvider,
  BiblePicker,
  NavBible,
  chapterName,
  useBibleLocation,
  useBibleNav,
  useScopedBibles,
} from "@/components/BibleNav";
import type { SidebarBook } from "@/utils/getSidebarBooks";

const navigation = vi.hoisted(() => ({
  pathname: "/bibles/de4e12af7f28f599-01",
  params: {} as Record<string, string | string[] | undefined>,
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({
    push: navigation.push,
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

//jsdom has no layout, so it has no scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

const KJV = "de4e12af7f28f599-01";
const DRA = "179568874c45066f-01";
const OTHER = "not-in-the-short-list-01";

const bibles: NavBible[] = [
  { id: KJV, name: "King James Version", abbreviation: "KJV", language: "English" },
  { id: DRA, name: "Douay-Rheims", abbreviation: "DRA", language: "English" },
  { id: OTHER, name: "Other Bible", abbreviation: "OTH", language: "Latin" },
];

const books: SidebarBook[] = [
  { id: "GEN", name: "Genesis", chapters: [{ id: "GEN.1", number: "1" }] },
];

const Provider = ({
  children,
  bibleId = KJV,
}: {
  children: ReactNode;
  bibleId?: string;
}) => (
  <BibleNavProvider bibleId={bibleId} bibles={bibles} books={books}>
    {children}
  </BibleNavProvider>
);

const jsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

beforeEach(() => {
  navigation.pathname = `/bibles/${KJV}`;
  navigation.params = {};
  navigation.push.mockClear();
  navigation.replace.mockClear();
  navigation.refresh.mockClear();
});

describe("BibleNavProvider", () => {
  it("gives no data outside the provider", () => {
    const { result } = renderHook(() => useBibleNav());
    expect(result.current).toBeNull();
  });

  it("gives the Bible, the Bibles and the books", () => {
    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    expect(result.current).toMatchObject({ bibleId: KJV, bibles, books, verses: {} });
  });

  it("loads the verses of a chapter from the route of the demo", async () => {
    const verses = [{ id: "GEN.1.1", number: "1" }];
    const fetchMock = vi.fn(async () => jsonResponse(verses));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    result.current?.loadVerses("GEN.1");

    await waitFor(() => expect(result.current?.verses["GEN.1"]).toEqual(verses));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `/api/bibles/${KJV}/chapters/GEN.1/verses`,
    );
  });

  it("requests each chapter only once", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    //A second call while the first request is in progress
    result.current?.loadVerses("GEN.1");
    result.current?.loadVerses("GEN.1");
    await waitFor(() => expect(result.current?.verses["GEN.1"]).toEqual([]));
    //A call after the verses are loaded
    result.current?.loadVerses("GEN.1");

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("marks a chapter as an error when the response is not OK, and tries again on the next call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "no" }, 500))
      .mockResolvedValueOnce(jsonResponse([{ id: "GEN.1.1", number: "1" }]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    result.current?.loadVerses("GEN.1");
    await waitFor(() => expect(result.current?.verses["GEN.1"]).toBe("error"));

    result.current?.loadVerses("GEN.1");
    await waitFor(() =>
      expect(result.current?.verses["GEN.1"]).toEqual([{ id: "GEN.1.1", number: "1" }]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the verses of the other chapters when a chapter loads", async () => {
    const verses = (chapter: string) => [{ id: `${chapter}.1`, number: "1" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        jsonResponse(verses(url.includes("GEN.1") ? "GEN.1" : "GEN.2")),
      ),
    );

    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    result.current?.loadVerses("GEN.1");
    await waitFor(() => expect(result.current?.verses["GEN.1"]).toEqual(verses("GEN.1")));
    result.current?.loadVerses("GEN.2");

    await waitFor(() => expect(result.current?.verses["GEN.2"]).toEqual(verses("GEN.2")));
    expect(result.current?.verses["GEN.1"]).toEqual(verses("GEN.1"));
  });

  it("keeps the verses of the other chapters when a chapter fails", async () => {
    const verses = [{ id: "GEN.1.1", number: "1" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("GEN.1") ? jsonResponse(verses) : jsonResponse({}, 500),
      ),
    );

    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    result.current?.loadVerses("GEN.1");
    await waitFor(() => expect(result.current?.verses["GEN.1"]).toEqual(verses));
    result.current?.loadVerses("GEN.2");

    await waitFor(() => expect(result.current?.verses["GEN.2"]).toBe("error"));
    expect(result.current?.verses["GEN.1"]).toEqual(verses);
  });

  it("requests the verses from the Bible that the provider has now", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    let bibleId = KJV;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider bibleId={bibleId}>{children}</Provider>
    );

    const { result, rerender } = renderHook(() => useBibleNav(), { wrapper });
    bibleId = DRA;
    rerender();
    result.current?.loadVerses("GEN.1");

    await waitFor(() => expect(result.current?.verses["GEN.1"]).toEqual([]));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `/api/bibles/${DRA}/chapters/GEN.1/verses`,
    );
  });

  it("marks a chapter as an error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));

    const { result } = renderHook(() => useBibleNav(), { wrapper: Provider });
    result.current?.loadVerses("GEN.1");
    await waitFor(() => expect(result.current?.verses["GEN.1"]).toBe("error"));
  });
});

describe("useBibleLocation", () => {
  it.each<[string, Record<string, string | string[]>, object]>([
    ["no IDs", {}, {}],
    ["a book", { bookId: "GEN" }, { bookId: "GEN" }],
    ["a chapter", { chapterId: "GEN.1" }, { bookId: "GEN", chapterId: "GEN.1" }],
    [
      "a verse",
      { verseId: "GEN.1.3" },
      { bookId: "GEN", chapterId: "GEN.1", verseId: "GEN.1.3" },
    ],
    [
      "a passage",
      { passageId: "GEN.1.1-GEN.2.3" },
      { bookId: "GEN", chapterId: "GEN.1", verseId: "GEN.1.1", endVerseId: "GEN.2.3" },
    ],
    [
      "a passage with one verse",
      { passageId: "GEN.1.1" },
      { bookId: "GEN", chapterId: "GEN.1", verseId: "GEN.1.1" },
    ],
    ["a section", { sectionId: "GEN.S1" }, { bookId: "GEN" }],
    ["an encoded ID", { chapterId: "GEN%2E1" }, { bookId: "GEN", chapterId: "GEN.1" }],
    ["an ID in an array", { chapterId: ["GEN.2", "x"] }, { bookId: "GEN", chapterId: "GEN.2" }],
  ])("finds the location of %s", (_name, params, expected) => {
    navigation.params = params;
    const { result } = renderHook(() => useBibleLocation());
    expect(result.current).toEqual({
      bookId: undefined,
      chapterId: undefined,
      verseId: undefined,
      endVerseId: undefined,
      ...expected,
    });
  });

  it("prefers the verse over the book in the same URL", () => {
    navigation.params = { bookId: "EXO", verseId: "GEN.1.1" };
    const { result } = renderHook(() => useBibleLocation());
    expect(result.current.bookId).toBe("GEN");
  });
});

describe("chapterName", () => {
  it("names an intro chapter Introduction", () => {
    expect(chapterName("intro")).toBe("Introduction");
  });

  it("names a numbered chapter with its number", () => {
    expect(chapterName("12")).toBe("Chapter 12");
  });
});

describe("useScopedBibles", () => {
  it("gives no Bibles outside the provider", () => {
    const { result } = renderHook(() => useScopedBibles());
    expect(result.current).toEqual([]);
  });

  it("gives the short list and the current Bible by default", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider bibleId={OTHER}>{children}</Provider>
    );
    const { result } = renderHook(() => useScopedBibles(), { wrapper });
    expect(result.current.map(({ id }) => id)).toEqual([KJV, DRA, OTHER]);
  });

  it("leaves out Bibles that are not in the short list", () => {
    const { result } = renderHook(() => useScopedBibles(), { wrapper: Provider });
    expect(result.current.map(({ id }) => id)).toEqual([KJV, DRA]);
  });

  it("gives all Bibles when the scope is all", () => {
    document.cookie = "bible-scope=all; path=/";
    const { result } = renderHook(() => useScopedBibles(), { wrapper: Provider });
    expect(result.current.map(({ id }) => id)).toEqual([KJV, DRA, OTHER]);
  });
});

describe("BiblePicker", () => {
  it("shows nothing outside the provider", () => {
    const { container } = render(<BiblePicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the abbreviation of the current Bible", () => {
    render(<BiblePicker />, { wrapper: Provider });
    expect(screen.getByRole("button", { name: "Bible: KJV" })).toBeInTheDocument();
  });

  it("lists each Bible with its abbreviation and language", async () => {
    const user = userEvent.setup();
    render(<BiblePicker />, { wrapper: Provider });
    await user.click(screen.getByRole("button", { name: "Bible: KJV" }));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[1]).toHaveTextContent("Douay-Rheims");
    expect(options[1]).toHaveTextContent("DRA · English");
  });

  it("marks the current Bible as the selected and highlighted option", async () => {
    const user = userEvent.setup();
    render(<BiblePicker />, { wrapper: ({ children }) => <Provider bibleId={DRA}>{children}</Provider> });
    await user.click(screen.getByRole("button", { name: "Bible: DRA" }));

    const current = screen.getByRole("option", { selected: true });
    expect(current).toHaveTextContent("Douay-Rheims");
    expect(screen.getByRole("option", { selected: false })).toHaveTextContent("King James Version");
    //The list opens with the current Bible highlighted, not the first one
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", current.id);
  });

  it("opens the page of the selected Bible", async () => {
    const user = userEvent.setup();
    render(<BiblePicker />, { wrapper: Provider });
    await user.click(screen.getByRole("button", { name: "Bible: KJV" }));
    await user.type(screen.getByRole("combobox"), "douay{Enter}");

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(`/bibles/${DRA}`);
  });

  it("opens the Bibles page from the action", async () => {
    const user = userEvent.setup();
    render(<BiblePicker />, { wrapper: Provider });
    await user.click(screen.getByRole("button", { name: "Bible: KJV" }));
    await user.click(screen.getByText("Open the Bibles page"));

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/bibles");
  });

  it("lists all Bibles after the switch is set to All", async () => {
    const user = userEvent.setup();
    render(<BiblePicker />, { wrapper: Provider });
    await user.click(screen.getByRole("button", { name: "Bible: KJV" }));
    expect(screen.queryByText("Other Bible")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(await screen.findByText("Other Bible")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("shows its empty text when no Bible matches", async () => {
    const user = userEvent.setup();
    render(<BiblePicker />, { wrapper: Provider });
    await user.click(screen.getByRole("button", { name: "Bible: KJV" }));
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("No Bible has this text.")).toBeInTheDocument();
  });

  it("shows the label when the current Bible is not in the list", () => {
    render(
      <BibleNavProvider bibleId="unknown" bibles={bibles} books={books}>
        <BiblePicker />
      </BibleNavProvider>,
    );
    expect(screen.getByRole("button", { name: "Bible: Bible" })).toBeInTheDocument();
  });
});
