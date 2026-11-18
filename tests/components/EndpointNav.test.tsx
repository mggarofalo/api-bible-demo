import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BibleNavProvider } from "@/components/BibleNav";
import { EndpointNav, Tip } from "@/components/EndpointNav";
import { getEndpoint } from "@/utils/apiReference";
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

//Stub of next/link that shows the prefetch prop, which the real link does not render
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const books: SidebarBook[] = [
  {
    id: "GEN",
    name: "Genesis",
    chapters: [
      { id: "GEN.1", number: "1" },
      { id: "GEN.2", number: "2" },
    ],
  },
];

const bibles = [
  { id: "bible1", name: "Test Bible", abbreviation: "TB", language: "English" },
];

const setRoute = (pathname: string, params: Record<string, string> = {}) => {
  route.pathname = pathname;
  route.params = params;
};

const renderNav = (bibleList = bibles) =>
  render(
    <BibleNavProvider bibleId="bible1" bibles={bibleList} books={books}>
      <EndpointNav />
    </BibleNavProvider>,
  );

const linkNames = () =>
  screen.getAllByRole("link").map((link) => link.textContent);

describe("EndpointNav", () => {
  beforeEach(() => setRoute("/"));

  it("renders nothing outside a Bible", () => {
    const { container } = render(<EndpointNav />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Bible links with the abbreviation as the row name", () => {
    setRoute("/bibles/bible1");
    renderNav();

    const nav = screen.getByRole("navigation", {
      name: "Endpoints for this location",
    });
    expect(within(nav).getByText("TB")).toBeInTheDocument();
    expect(linkNames()).toEqual(["Bible", "Books", "Search"]);
    expect(screen.getByRole("link", { name: "Bible" })).toHaveAttribute(
      "href",
      "/bibles/bible1",
    );
    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books",
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/bibles/bible1/search",
    );
  });

  it("names the row Bible when the Bible is not in the list", () => {
    setRoute("/bibles/bible1");
    renderNav([]);
    expect(screen.getByText("Bible", { selector: "span.text-zinc-500" })).toBeInTheDocument();
  });

  it("adds the book links on a book page", () => {
    setRoute("/bibles/bible1/books/GEN", { bookId: "GEN" });
    renderNav();

    expect(screen.getByText("Genesis")).toBeInTheDocument();
    expect(linkNames()).toEqual([
      "Bible",
      "Books",
      "Search",
      "Book",
      "Chapters",
      "Sections",
    ]);
    expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books/GEN",
    );
    expect(screen.getByRole("link", { name: "Chapters" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books/GEN/chapters",
    );
    expect(screen.getByRole("link", { name: "Sections" })).toHaveAttribute(
      "href",
      "/bibles/bible1/books/GEN/sections",
    );
  });

  it("adds the chapter links on a chapter page", () => {
    setRoute("/bibles/bible1/chapters/GEN.2", { chapterId: "GEN.2" });
    renderNav();

    expect(screen.getByText("Genesis 2")).toBeInTheDocument();
    expect(linkNames()).toEqual([
      "Bible",
      "Books",
      "Search",
      "Book",
      "Chapters",
      "Sections",
      "Chapter",
      "Verses",
      "Sections",
    ]);
    expect(screen.getByRole("link", { name: "Chapter" })).toHaveAttribute(
      "href",
      "/bibles/bible1/chapters/GEN.2",
    );
    expect(screen.getByRole("link", { name: "Verses" })).toHaveAttribute(
      "href",
      "/bibles/bible1/chapters/GEN.2/verses",
    );
    expect(screen.getAllByRole("link", { name: "Sections" })[1]).toHaveAttribute(
      "href",
      "/bibles/bible1/chapters/GEN.2/sections",
    );
  });

  it("adds the verse link on a verse page", () => {
    setRoute("/bibles/bible1/verses/GEN.1.3", { verseId: "GEN.1.3" });
    renderNav();

    expect(screen.getByText("Genesis 1:3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verse" })).toHaveAttribute(
      "href",
      "/bibles/bible1/verses/GEN.1.3",
    );
    expect(
      screen.queryByRole("link", { name: "Passage" }),
    ).not.toBeInTheDocument();
  });

  it("adds the passage link on a passage page", () => {
    setRoute("/bibles/bible1/passages/GEN.1.1-GEN.1.3", {
      passageId: "GEN.1.1-GEN.1.3",
    });
    renderNav();

    expect(screen.getByRole("link", { name: "Verse" })).toHaveAttribute(
      "href",
      "/bibles/bible1/verses/GEN.1.1",
    );
    expect(screen.getByRole("link", { name: "Passage" })).toHaveAttribute(
      "href",
      "/bibles/bible1/passages/GEN.1.1-GEN.1.3",
    );
  });

  it("shows only the Bible links for a book that the Bible does not have", () => {
    setRoute("/bibles/bible1/books/XXX", { bookId: "XXX" });
    renderNav();
    expect(linkNames()).toEqual(["Bible", "Books", "Search"]);
  });

  it("never prefetches a link, so hovering does not call the API", () => {
    setRoute("/bibles/bible1/passages/GEN.1.1-GEN.1.3", {
      passageId: "GEN.1.1-GEN.1.3",
    });
    renderNav();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(3);
    for (const link of links) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it.each([
    ["a chapter", "/bibles/bible1/chapters/XXX.1", { chapterId: "XXX.1" }],
    ["a verse", "/bibles/bible1/verses/XXX.1.2", { verseId: "XXX.1.2" }],
    [
      "a passage",
      "/bibles/bible1/passages/XXX.1.2-XXX.1.3",
      { passageId: "XXX.1.2-XXX.1.3" },
    ],
  ])("shows only the Bible links for %s of a book that the Bible does not have", (_name, path, params) => {
    setRoute(path, params);
    renderNav();
    expect(linkNames()).toEqual(["Bible", "Books", "Search"]);
    expect(screen.queryByText(/XXX/)).not.toBeInTheDocument();
  });

  it("marks only the link of the current page", () => {
    setRoute("/bibles/bible1/books/GEN/chapters", { bookId: "GEN" });
    renderNav();

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Chapters");
    expect(current[0]).toHaveAttribute(
      "href",
      "/bibles/bible1/books/GEN/chapters",
    );
  });

  it("marks no link on a page that has no link in the nav", () => {
    setRoute("/bibles/bible1/books/GEN/something", { bookId: "GEN" });
    renderNav();
    expect(
      document.querySelector('[aria-current="page"]'),
    ).not.toBeInTheDocument();
  });

  describe("help tips", () => {
    it("shows the route and the summary from the API reference", () => {
      setRoute("/bibles/bible1");
      renderNav();

      const bible = screen.getByRole("link", { name: "Bible" });
      const tip = within(bible.parentElement as HTMLElement).getByRole(
        "tooltip",
        { hidden: true },
      );
      const summary = getEndpoint("/bibles/{bibleId}")?.summary;
      expect(summary).toBeTruthy();
      expect(tip).toHaveTextContent("/bibles/{bibleId}");
      expect(tip).toHaveTextContent(summary as string);
    });

    //Each link with the route that its tip must show. "Sections" is in two rows.
    const tipRoutes: [string, string, string][] = [
      ["Bible", "/bibles/bible1", "/bibles/{bibleId}"],
      ["Books", "/bibles/bible1/books", "/bibles/{bibleId}/books"],
      ["Search", "/bibles/bible1/search", "/bibles/{bibleId}/search"],
      ["Book", "/bibles/bible1/books/GEN", "/bibles/{bibleId}/books/{bookId}"],
      ["Chapters", "/bibles/bible1/books/GEN/chapters", "/bibles/{bibleId}/books/{bookId}/chapters"],
      ["Sections", "/bibles/bible1/books/GEN/sections", "/bibles/{bibleId}/books/{bookId}/sections"],
      ["Chapter", "/bibles/bible1/chapters/GEN.1", "/bibles/{bibleId}/chapters/{chapterId}"],
      ["Verses", "/bibles/bible1/chapters/GEN.1/verses", "/bibles/{bibleId}/chapters/{chapterId}/verses"],
      ["Sections", "/bibles/bible1/chapters/GEN.1/sections", "/bibles/{bibleId}/chapters/{chapterId}/sections"],
      ["Verse", "/bibles/bible1/verses/GEN.1.1", "/bibles/{bibleId}/verses/{verseId}"],
      ["Passage", "/bibles/bible1/passages/GEN.1.1-GEN.1.3", "/bibles/{bibleId}/passages/{passageId}"],
    ];

    it("has a tip for every link of a passage page", () => {
      setRoute("/bibles/bible1/passages/GEN.1.1-GEN.1.3", {
        passageId: "GEN.1.1-GEN.1.3",
      });
      renderNav();
      expect(screen.getAllByRole("tooltip", { hidden: true })).toHaveLength(tipRoutes.length);
      expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
        tipRoutes.map(([, href]) => href),
      );
    });

    it.each(tipRoutes)(
      "shows the route and the reference summary in the tip of %s (%s)",
      (label, href, endpointRoute) => {
        setRoute("/bibles/bible1/passages/GEN.1.1-GEN.1.3", {
          passageId: "GEN.1.1-GEN.1.3",
        });
        renderNav();
        const link = screen
          .getAllByRole("link", { name: label })
          .find((item) => item.getAttribute("href") === href)!;
        expect(link).toBeDefined();
        const tip = within(link.parentElement as HTMLElement).getByRole("tooltip", {
          hidden: true,
        });
        const summary = getEndpoint(endpointRoute)?.summary;
        expect(summary, endpointRoute).toBeTruthy();
        expect(tip.firstElementChild?.textContent).toBe(endpointRoute);
        expect(tip.textContent).toBe(`${endpointRoute}${summary}`);
      },
    );
  });
});

describe("Tip", () => {
  it("renders its content and a tooltip with the tip text", () => {
    render(
      <Tip tip="Help text" className="extra">
        <button type="button">Target</button>
      </Tip>,
    );
    expect(screen.getByRole("button", { name: "Target" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(
      "Help text",
    );
    expect(screen.getByRole("button").parentElement).toHaveClass("extra");
  });
});
