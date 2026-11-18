import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BibleNavProvider } from "@/components/BibleNav";
import { BibleSidebar } from "@/components/BibleSidebar";
import type { SidebarBook } from "@/utils/getSidebarBooks";

const route = vi.hoisted(() => ({
  pathname: "/",
  params: {} as Record<string, string | string[] | undefined>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useParams: () => route.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const books: SidebarBook[] = [
  {
    id: "GEN",
    name: "Genesis",
    chapters: [
      { id: "GEN.intro", number: "intro" },
      { id: "GEN.1", number: "1" },
      { id: "GEN.2", number: "2" },
    ],
  },
  { id: "EXO", name: "Exodus", chapters: [{ id: "EXO.1", number: "1" }] },
];

const verses = [
  { id: "GEN.1.1", number: "1" },
  { id: "GEN.1.2", number: "2" },
  { id: "GEN.1.3", number: "3" },
];

const json = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

const mockFetch = (impl?: (url: string) => unknown) => {
  const fetchMock = vi.fn(async (url: string) =>
    impl ? impl(url) : json(verses),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const setRoute = (pathname: string, params: Record<string, string> = {}) => {
  route.pathname = pathname;
  route.params = params;
};

const renderSidebar = (bibleId = "bible1") =>
  render(
    <BibleNavProvider bibleId={bibleId} bibles={[]} books={books}>
      <BibleSidebar />
    </BibleNavProvider>,
  );

const toggle = () =>
  screen.getByRole("button", {
    name: /^(Open the sidebar|Keep the sidebar open|Close the sidebar)$/,
  });

//The sidebar opens when the pointer is on the toggle button
const openByHover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.hover(toggle());
  return screen.findByRole("complementary", {
    name: "Books, chapters and verses",
  });
};

describe("BibleSidebar", () => {
  beforeEach(() => {
    setRoute("/");
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders nothing outside a Bible", () => {
    const { container } = render(<BibleSidebar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts closed with only the toggle button", () => {
    mockFetch();
    renderSidebar();
    expect(toggle()).toHaveAccessibleName("Open the sidebar");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("opens on hover and lists the books with links", async () => {
    mockFetch();
    const user = userEvent.setup();
    renderSidebar();

    const aside = await openByHover(user);

    expect(toggle()).toHaveAccessibleName("Keep the sidebar open");
    //Open by hover, not pinned: the button still says the sidebar is expanded
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(within(aside).getByRole("link", { name: "Books" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books",
    );
    expect(within(aside).getByRole("link", { name: "Genesis" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books/GEN",
    );
    expect(within(aside).getByRole("link", { name: "Exodus" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books/EXO",
    );
  });

  describe("close delay", () => {
    //Fake timers, so the test sees the exact moment of the close. Events come from
    //fireEvent because user-event waits on real timers.
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    beforeEach(() => {
      vi.useFakeTimers();
      mockFetch();
      renderSidebar();
      fireEvent.mouseEnter(toggle());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("closes only after 250 ms without the pointer", () => {
      expect(screen.getByRole("complementary")).toBeInTheDocument();

      fireEvent.mouseLeave(toggle());
      advance(249);
      expect(screen.getByRole("complementary")).toBeInTheDocument();

      advance(1);
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    });

    it("stays open when the pointer returns before the delay ends", () => {
      fireEvent.mouseLeave(toggle());
      advance(200);
      fireEvent.mouseEnter(toggle());

      //The first close is cancelled, so no close comes later
      advance(1000);
      expect(screen.getByRole("complementary")).toBeInTheDocument();
    });
  });

  it("pins on click, remembers it and moves the page", async () => {
    mockFetch();
    const user = userEvent.setup();
    renderSidebar();

    await user.click(toggle());

    expect(toggle()).toHaveAccessibleName("Close the sidebar");
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(window.localStorage.getItem("bible-sidebar-pinned")).toBe("true");
    expect(document.body).toHaveClass("sidebar-pinned");

    await user.click(toggle());

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("bible-sidebar-pinned")).toBe("false");
    expect(document.body).not.toHaveClass("sidebar-pinned");
  });

  it("starts pinned when the browser remembers it", () => {
    window.localStorage.setItem("bible-sidebar-pinned", "true");
    mockFetch();
    renderSidebar();
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(toggle()).toHaveAccessibleName("Close the sidebar");
  });

  it("removes the page offset when it unmounts", () => {
    window.localStorage.setItem("bible-sidebar-pinned", "true");
    mockFetch();
    const { unmount } = renderSidebar();
    expect(document.body).toHaveClass("sidebar-pinned");
    unmount();
    expect(document.body).not.toHaveClass("sidebar-pinned");
  });

  describe("books and chapters", () => {
    it("shows no chapters until a book opens", async () => {
      mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      expect(
        screen.queryByRole("link", { name: "Chapter 1" }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Show the chapters of Genesis" }),
      );

      expect(
        screen.getByRole("button", { name: "Hide the chapters of Genesis" }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: "Introduction" })).toHaveAttribute(
        "href",
        "/bibles/bible1/chapters/GEN.intro",
      );
      expect(screen.getByRole("link", { name: "Chapter 2" })).toHaveAttribute(
        "href",
        "/bibles/bible1/chapters/GEN.2",
      );
    });

    it("collapses an open book", async () => {
      setRoute("/bibles/bible1/books/GEN", { bookId: "GEN" });
      mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);
      expect(screen.getByRole("link", { name: "Chapter 1" })).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Hide the chapters of Genesis" }),
      );

      expect(
        screen.queryByRole("link", { name: "Chapter 1" }),
      ).not.toBeInTheDocument();
    });

    it("opens the book of the current page and scrolls it into view", async () => {
      setRoute("/bibles/bible1/books/EXO", { bookId: "EXO" });
      mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      expect(
        screen.getByRole("button", { name: "Hide the chapters of Exodus" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Show the chapters of Genesis" }),
      ).toBeInTheDocument();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
      });
    });
  });

  describe("verses", () => {
    it("loads the verses of the current chapter when the sidebar opens", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1", { chapterId: "GEN.1" });
      const fetchMock = mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      //A closed sidebar makes no request
      expect(fetchMock).not.toHaveBeenCalled();

      await openByHover(user);

      expect(await screen.findByRole("link", { name: "2" })).toHaveAttribute(
        "href",
        "/bibles/bible1/verses/GEN.1.2",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bibles/bible1/chapters/GEN.1/verses",
      );
      expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
        "title",
        "GEN.1.3",
      );
    });

    it("shows a waiting message until the verses arrive", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1", { chapterId: "GEN.1" });
      let finish: (value: unknown) => void = () => {};
      mockFetch(() => new Promise((resolve) => (finish = resolve)));
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      expect(screen.getByText("Wait for the verses.")).toBeInTheDocument();

      finish(json(verses));

      expect(await screen.findByRole("link", { name: "1" })).toBeInTheDocument();
      expect(screen.queryByText("Wait for the verses.")).not.toBeInTheDocument();
    });

    it("makes no request when a book opens, and one request when a chapter opens", async () => {
      const fetchMock = mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      await user.click(
        screen.getByRole("button", { name: "Show the chapters of Genesis" }),
      );
      expect(fetchMock).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole("button", {
          name: "Show the verses of Genesis, Chapter 2",
        }),
      );
      await screen.findByRole("link", { name: "1" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bibles/bible1/chapters/GEN.2/verses",
      );
    });

    it("loads the verses when the user opens a chapter", async () => {
      setRoute("/bibles/bible1/books/GEN", { bookId: "GEN" });
      const fetchMock = mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);
      expect(fetchMock).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole("button", {
          name: "Show the verses of Genesis, Chapter 2",
        }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bibles/bible1/chapters/GEN.2/verses",
      );
      expect(await screen.findByRole("link", { name: "1" })).toBeInTheDocument();
    });

    it("does not fetch a chapter again after it loaded", async () => {
      setRoute("/bibles/bible1/books/GEN", { bookId: "GEN" });
      const fetchMock = mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);
      const show = "Show the verses of Genesis, Chapter 2";

      await user.click(screen.getByRole("button", { name: show }));
      await screen.findByRole("link", { name: "1" });
      await user.click(
        screen.getByRole("button", {
          name: "Hide the verses of Genesis, Chapter 2",
        }),
      );
      expect(screen.queryByRole("link", { name: "1" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: show }));

      //The verses show again at once, from memory
      expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("shows a failure message when the route answers with an error", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1", { chapterId: "GEN.1" });
      mockFetch(() => json({}, 500));
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      expect(
        await screen.findByText("The verses did not load."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Wait for the verses.")).not.toBeInTheDocument();
    });

    it("shows a failure message when the request fails, and retries on the next open", async () => {
      setRoute("/bibles/bible1/books/GEN", { bookId: "GEN" });
      let fail = true;
      const fetchMock = mockFetch(() => {
        if (fail) {
          throw new Error("offline");
        }
        return json(verses);
      });
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);
      const show = "Show the verses of Genesis, Chapter 1";
      const hide = "Hide the verses of Genesis, Chapter 1";

      await user.click(screen.getByRole("button", { name: show }));
      expect(
        await screen.findByText("The verses did not load."),
      ).toBeInTheDocument();

      fail = false;
      await user.click(screen.getByRole("button", { name: hide }));
      await user.click(screen.getByRole("button", { name: show }));

      expect(await screen.findByRole("link", { name: "1" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("says when a chapter has no verses", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1", { chapterId: "GEN.1" });
      mockFetch(() => json([]));
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      expect(
        await screen.findByText("This chapter has no verses."),
      ).toBeInTheDocument();
    });
  });

  describe("current location", () => {
    //Only one element of the sidebar can say that it is the current page
    const currentLinks = (sidebar: HTMLElement) =>
      Array.from(sidebar.querySelectorAll("[aria-current]"));

    it("marks only the chapter link as the current page on a chapter page", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1", { chapterId: "GEN.1" });
      mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      const sidebar = await openByHover(user);
      await screen.findByRole("link", { name: "1" });

      const current = screen.getByRole("link", { name: "Chapter 1" });
      expect(current).toHaveAttribute("aria-current", "page");
      //The book is in the path, but it is not the page
      expect(screen.getByRole("link", { name: "Genesis" })).not.toHaveAttribute(
        "aria-current",
      );
      expect(currentLinks(sidebar)).toEqual([current]);
    });

    it("marks only the verse link as the current page and opens its chapter on a verse page", async () => {
      setRoute("/bibles/bible1/verses/GEN.1.2", { verseId: "GEN.1.2" });
      const fetchMock = mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      const sidebar = await openByHover(user);

      const verse = await screen.findByRole("link", { name: "2" });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bibles/bible1/chapters/GEN.1/verses",
      );
      expect(verse).toHaveAttribute("aria-current", "page");
      //The chapter and the book are in the path, but they are not the page
      expect(screen.getByRole("link", { name: "Chapter 1" })).not.toHaveAttribute(
        "aria-current",
      );
      expect(currentLinks(sidebar)).toEqual([verse]);
    });

    it("marks no link as the current page on a page that is in a chapter but is not the chapter", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1/verses", { chapterId: "GEN.1" });
      mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      const sidebar = await openByHover(user);
      await screen.findByRole("link", { name: "1" });

      expect(currentLinks(sidebar)).toEqual([]);
    });

    it("decodes the encoded IDs of the URL", async () => {
      setRoute("/bibles/bible1/chapters/GEN.1", { chapterId: "GEN%2E1" });
      const fetchMock = mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      await openByHover(user);

      await screen.findByRole("link", { name: "1" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bibles/bible1/chapters/GEN.1/verses",
      );
    });

    it("marks only the book link as the current page on a book page", async () => {
      setRoute("/bibles/bible1/books/GEN", { bookId: "GEN" });
      mockFetch();
      const user = userEvent.setup();
      renderSidebar();
      const sidebar = await openByHover(user);

      const book = screen.getByRole("link", { name: "Genesis" });
      expect(book).toHaveAttribute("aria-current", "page");
      expect(currentLinks(sidebar)).toEqual([book]);
    });
  });
});
