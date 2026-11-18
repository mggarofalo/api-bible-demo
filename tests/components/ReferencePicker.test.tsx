import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BibleNavProvider, NavBible, NavVerse } from "@/components/BibleNav";
import { ReferencePanel, ReferencePicker } from "@/components/ReferencePicker";
import type { SidebarBook } from "@/utils/getSidebarBooks";

const navigation = vi.hoisted(() => ({
  pathname: "/bibles/b1",
  params: {} as Record<string, string>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

//A plain link, so a click does not try to load a page in jsdom
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    className,
  }: {
    href: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    children: ReactNode;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

const bibles: NavBible[] = [
  { id: "b1", name: "Bible One", abbreviation: "B1", language: "English" },
];

const books: SidebarBook[] = [
  {
    id: "GEN",
    name: "Genesis",
    chapters: [
      { id: "GEN.intro", number: "intro" },
      { id: "GEN.1", number: "1" },
      { id: "GEN.2", number: "2" },
      { id: "GEN.3", number: "3" },
    ],
  },
  { id: "OBA", name: "Obadiah", chapters: [{ id: "OBA.1", number: "1" }] },
];

const verses = (chapterId: string, count: number): NavVerse[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${chapterId}.${index + 1}`,
    number: String(index + 1),
  }));

const VERSES: Record<string, NavVerse[]> = {
  "GEN.intro": [],
  "GEN.1": verses("GEN.1", 3),
  "GEN.2": verses("GEN.2", 2),
  "GEN.3": verses("GEN.3", 4),
  "OBA.1": verses("OBA.1", 2),
};

const chapterOfUrl = (url: string) => url.split("/chapters/")[1].split("/")[0];

let fetchMock: ReturnType<typeof vi.fn>;

const stubFetch = (
  answer: (chapterId: string) => Promise<unknown> = async (chapterId) => ({
    ok: true,
    status: 200,
    json: async () => VERSES[chapterId],
  }),
) => {
  fetchMock = vi.fn((url: string) => answer(chapterOfUrl(url)));
  vi.stubGlobal("fetch", fetchMock);
};

const Provider = ({ children }: { children: ReactNode }) => (
  <BibleNavProvider bibleId="b1" bibles={bibles} books={books}>
    {children}
  </BibleNavProvider>
);

const select = (name: string) => screen.getByRole("combobox", { name });

const optionLabels = (name: string) =>
  within(select(name))
    .queryAllByRole("option")
    .map((option) => option.textContent);

//Waits for the option to be in the list (the verses load from the network), then selects it
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  optionText: string,
) => {
  const option = await waitFor(() =>
    within(select(name)).getByRole("option", { name: optionText }),
  );
  await waitFor(() => expect(select(name)).toBeEnabled());
  await user.selectOptions(select(name), option);
};

const openLink = () => screen.queryByRole("link", { name: "Open" });

beforeEach(() => {
  navigation.pathname = "/bibles/b1";
  navigation.params = {};
  stubFetch();
});

describe("ReferencePanel", () => {
  it("shows nothing outside a Bible", () => {
    const { container } = render(<ReferencePanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts empty with only the book list enabled", () => {
    render(<ReferencePanel />, { wrapper: Provider });

    expect(select("Book")).toHaveValue("");
    expect(optionLabels("Book")).toEqual(["Book", "Genesis", "Obadiah"]);
    expect(select("Chapter")).toBeDisabled();
    expect(select("Verse")).toBeDisabled();
    expect(select("Last chapter")).toBeDisabled();
    expect(select("Last verse")).toBeDisabled();
    expect(openLink()).not.toBeInTheDocument();
    expect(screen.getByText("Select a book.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  //Each row: the selections in order, then the page that "Open" goes to
  it.each<[string, [string, string][], string]>([
    ["a book", [["Book", "Genesis"]], "/bibles/b1/books/GEN"],
    [
      "a chapter",
      [
        ["Book", "Genesis"],
        ["Chapter", "2"],
      ],
      "/bibles/b1/chapters/GEN.2",
    ],
    [
      "an intro chapter",
      [
        ["Book", "Genesis"],
        ["Chapter", "intro"],
      ],
      "/bibles/b1/chapters/GEN.intro",
    ],
    [
      "a verse",
      [
        ["Book", "Genesis"],
        ["Chapter", "1"],
        ["Verse", "2"],
      ],
      "/bibles/b1/verses/GEN.1.2",
    ],
    [
      "a range in one chapter",
      [
        ["Book", "Genesis"],
        ["Chapter", "1"],
        ["Verse", "1"],
        ["Last verse", "3"],
      ],
      "/bibles/b1/passages/GEN.1.1-GEN.1.3",
    ],
    [
      "a range with no end",
      [
        ["Book", "Genesis"],
        ["Chapter", "1"],
        ["Verse", "1"],
        ["Last verse", "3"],
        ["Last verse", "None"],
      ],
      "/bibles/b1/verses/GEN.1.1",
    ],
    [
      "a range to a later chapter",
      [
        ["Book", "Genesis"],
        ["Chapter", "1"],
        ["Verse", "2"],
        ["Last chapter", "3"],
        ["Last verse", "1"],
      ],
      "/bibles/b1/passages/GEN.1.2-GEN.3.1",
    ],
    [
      "a range to a later chapter with no end verse selected",
      [
        ["Book", "Genesis"],
        ["Chapter", "1"],
        ["Verse", "2"],
        ["Last chapter", "2"],
      ],
      "/bibles/b1/passages/GEN.1.2-GEN.2.2",
    ],
    [
      "a range that goes back to the same chapter",
      [
        ["Book", "Genesis"],
        ["Chapter", "1"],
        ["Verse", "2"],
        ["Last chapter", "2"],
        ["Last chapter", "Same"],
      ],
      "/bibles/b1/verses/GEN.1.2",
    ],
    [
      "a range in a book with one chapter",
      [
        ["Book", "Obadiah"],
        ["Chapter", "1"],
        ["Verse", "1"],
        ["Last verse", "2"],
      ],
      "/bibles/b1/passages/OBA.1.1-OBA.1.2",
    ],
  ])("opens %s", async (_name, steps, href) => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    for (const [name, option] of steps) {
      await choose(user, name, option);
    }

    expect(openLink()).toHaveAttribute("href", href);
    expect(screen.getByText(href, { selector: "code" })).toBeInTheDocument();
  });

  it("selects the last verse of a later chapter until the user selects one", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "3");
    await choose(user, "Last chapter", "3");

    await waitFor(() => expect(select("Last verse")).toHaveValue("GEN.3.4"));
    //A range to a later chapter must have an end, so there is no "None"
    expect(optionLabels("Last verse")).toEqual(["1", "2", "3", "4"]);
  });

  it("lists only later verses as the end of a range in one chapter", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "2");

    //Not the start verse, and not a verse before it
    expect(optionLabels("Last verse")).toEqual(["None", "3"]);
    expect(select("Last verse")).toHaveValue("");
  });

  it("disables the end verse when the start is the last verse of the chapter", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "3");

    expect(select("Last verse")).toBeDisabled();
    expect(optionLabels("Last verse")).toEqual(["None"]);
    //A later chapter is still possible
    expect(select("Last chapter")).toBeEnabled();
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/verses/GEN.1.3");
  });

  it("lists only later chapters as the end chapter", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "2");
    await choose(user, "Verse", "1");

    expect(optionLabels("Last chapter")).toEqual(["Same", "3"]);
  });

  it("lists no later chapter in a book with one chapter", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Obadiah");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");

    expect(optionLabels("Last chapter")).toEqual(["Same"]);
  });

  it("disables the verse list for a chapter with no verses", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "intro");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/bibles/b1/chapters/GEN.intro/verses"),
    );
    expect(select("Verse")).toBeDisabled();
    expect(optionLabels("Chapter")).toEqual(["All", "intro", "1", "2", "3"]);
  });

  it("clears the later selections when an earlier one changes", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");
    await choose(user, "Last chapter", "3");
    await choose(user, "Last verse", "2");
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/passages/GEN.1.1-GEN.3.2");

    //A new start verse clears the end
    await choose(user, "Verse", "2");
    expect(select("Last chapter")).toHaveValue("");
    expect(select("Last verse")).toHaveValue("");
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/verses/GEN.1.2");

    //A new end chapter clears the end verse
    await choose(user, "Last chapter", "2");
    await choose(user, "Last verse", "1");
    await choose(user, "Last chapter", "3");
    expect(select("Last verse")).toHaveValue("GEN.3.4");

    //A new chapter clears the verse and the end
    await choose(user, "Chapter", "2");
    expect(select("Verse")).toHaveValue("");
    expect(select("Last chapter")).toHaveValue("");
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/chapters/GEN.2");

    //A new book clears all
    await choose(user, "Book", "Obadiah");
    expect(select("Chapter")).toHaveValue("");
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/books/OBA");

    //No book: nothing to open
    await choose(user, "Book", "Book");
    expect(openLink()).not.toBeInTheDocument();
    expect(screen.getByText("Select a book.")).toBeInTheDocument();
  });

  it("requests the verses of each chapter once", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");
    await choose(user, "Chapter", "2");
    await choose(user, "Verse", "1");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/bibles/b1/chapters/GEN.1/verses",
      "/api/bibles/b1/chapters/GEN.2/verses",
    ]);
  });

  it("waits for the verses of a later chapter before it can open the range", async () => {
    let finish: (value: unknown) => void = () => {};
    stubFetch((chapterId) =>
      chapterId === "GEN.3"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ ok: true, status: 200, json: async () => VERSES[chapterId] }),
    );
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");
    await choose(user, "Last chapter", "3");

    expect(screen.getByText("Wait for the verses.")).toBeInTheDocument();
    expect(openLink()).not.toBeInTheDocument();
    expect(select("Last verse")).toBeDisabled();

    finish({ ok: true, status: 200, json: async () => VERSES["GEN.3"] });
    expect(await screen.findByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/bibles/b1/passages/GEN.1.1-GEN.3.4",
    );
  });

  it("disables the verse list when the verses fail to load, and tries again later", async () => {
    let fail = true;
    stubFetch(async (chapterId) =>
      chapterId === "GEN.1" && fail
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => VERSES[chapterId] },
    );
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(select("Verse")).toBeDisabled();
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/chapters/GEN.1");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();

    //Select the chapter again: the next request succeeds
    fail = false;
    await choose(user, "Chapter", "2");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "3");
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/verses/GEN.1.3");
  });

  it("reports a failed load of the verses of the last chapter, and loads them again on request", async () => {
    let fail = true;
    stubFetch(async (chapterId) =>
      chapterId === "GEN.3" && fail
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => VERSES[chapterId] },
    );
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");
    await choose(user, "Last chapter", "3");

    //The form does not wait with no end
    expect(await screen.findByText("The verses did not load.")).toBeInTheDocument();
    expect(screen.queryByText("Wait for the verses.")).not.toBeInTheDocument();
    expect(openLink()).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/bibles/b1/passages/GEN.1.1-GEN.3.4",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("GEN.3")),
    ).toHaveLength(2);
  });

  it("shows no control to try again when the verses load", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");
    await choose(user, "Verse", "1");

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("starts at the passage of the current page", async () => {
    navigation.params = { passageId: "GEN.1.2-GEN.3.1" };
    navigation.pathname = "/bibles/b1/passages/GEN.1.2-GEN.3.1";
    render(<ReferencePanel />, { wrapper: Provider });

    expect(select("Book")).toHaveValue("GEN");
    expect(select("Chapter")).toHaveValue("GEN.1");
    await waitFor(() => expect(select("Verse")).toHaveValue("GEN.1.2"));
    expect(select("Last chapter")).toHaveValue("GEN.3");
    await waitFor(() => expect(select("Last verse")).toHaveValue("GEN.3.1"));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/bibles/b1/chapters/GEN.1/verses",
      "/api/bibles/b1/chapters/GEN.3/verses",
    ]);
    //The selection is the current page, so there is nothing to open
    expect(openLink()).not.toBeInTheDocument();
    expect(
      screen.getByText("/bibles/b1/passages/GEN.1.2-GEN.3.1", { selector: "code" }),
    ).toBeInTheDocument();
  });

  it("starts at a passage in one chapter of the current page", async () => {
    navigation.params = { passageId: "GEN.1.1-GEN.1.3" };
    render(<ReferencePanel />, { wrapper: Provider });

    expect(select("Last chapter")).toHaveValue("");
    await waitFor(() => expect(select("Last verse")).toHaveValue("GEN.1.3"));
    expect(openLink()).toHaveAttribute("href", "/bibles/b1/passages/GEN.1.1-GEN.1.3");
  });

  it("starts a passage in one chapter with Same and None as the end choices", async () => {
    navigation.params = { passageId: "GEN.1.1-GEN.1.3" };
    render(<ReferencePanel />, { wrapper: Provider });
    await waitFor(() => expect(select("Last verse")).toHaveValue("GEN.1.3"));

    //Same chapter: the selected option is "Same", and the end verse may still be "None"
    expect(
      within(select("Last chapter")).getByRole("option", { name: "Same" }),
    ).toHaveProperty("selected", true);
    expect(select("Last chapter")).toHaveDisplayValue("Same");
    expect(optionLabels("Last verse")).toEqual(["None", "2", "3"]);
    expect(select("Last verse")).toHaveDisplayValue("3");
  });

  it("enables the last chapter only after a verse is selected", async () => {
    const user = userEvent.setup();
    render(<ReferencePanel />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await choose(user, "Chapter", "1");

    //A book and a chapter, but no verse
    expect(select("Last chapter")).toBeDisabled();

    await choose(user, "Verse", "1");

    expect(select("Last chapter")).toBeEnabled();
  });

  it("calls onOpen when Open is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<ReferencePanel onOpen={onOpen} />, { wrapper: Provider });
    await choose(user, "Book", "Genesis");
    await user.click(screen.getByRole("link", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe("ReferencePicker", () => {
  it("shows nothing outside a Bible", () => {
    const { container } = render(<ReferencePicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each<[string, Record<string, string>, string]>([
    ["no reference", {}, "Select a reference"],
    ["an unknown book", { bookId: "XYZ" }, "Select a reference"],
    ["a book", { bookId: "GEN" }, "Genesis"],
    ["a section", { sectionId: "GEN.S1" }, "Genesis"],
    ["a chapter", { chapterId: "GEN.2" }, "Genesis 2"],
    ["a verse", { verseId: "GEN.1.3" }, "Genesis 1:3"],
    ["a passage in one chapter", { passageId: "GEN.1.1-GEN.1.3" }, "Genesis 1:1-3"],
    ["a passage to a later chapter", { passageId: "GEN.1.2-GEN.3.1" }, "Genesis 1:2-3:1"],
  ])("shows the text of %s", (_name, params, text) => {
    navigation.params = params;
    render(<ReferencePicker />, { wrapper: Provider });
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent(text);
    expect(button).toHaveAccessibleName(
      text === "Select a reference" ? text : `Reference: ${text}`,
    );
  });

  const openPicker = async () => {
    const user = userEvent.setup();
    const view = render(
      <div>
        <p>Outside</p>
        <ReferencePicker />
      </div>,
      { wrapper: Provider },
    );
    const button = screen.getByRole("button", { name: "Select a reference" });
    await user.click(button);
    return { ...view, user, button };
  };

  it("opens the form when the text is clicked", async () => {
    const { button } = await openPicker();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(select("Book")).toBeInTheDocument();
  });

  it("closes the form when the text is clicked again", async () => {
    const { button, user } = await openPicker();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox", { name: "Book" })).not.toBeInTheDocument();
  });

  it("closes the form with Escape", async () => {
    const { button, user } = await openPicker();
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("does not close the form on other keys", async () => {
    const { button, user } = await openPicker();
    await user.keyboard("a");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the form on a click out of it", async () => {
    const { button, user } = await openPicker();
    await user.click(screen.getByText("Outside"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open on a click in the form", async () => {
    const { button, user } = await openPicker();
    await choose(user, "Book", "Genesis");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the form when Open is clicked", async () => {
    const { button, user } = await openPicker();
    await choose(user, "Book", "Genesis");
    await user.click(screen.getByRole("link", { name: "Open" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the form on a new page", async () => {
    const { button, rerender } = await openPicker();
    navigation.pathname = "/bibles/b1/books/GEN";
    rerender(
      <div>
        <p>Outside</p>
        <ReferencePicker />
      </div>,
    );
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
