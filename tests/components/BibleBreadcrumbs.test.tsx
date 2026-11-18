import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BibleBreadcrumbs, RouteHero } from "@/components/BibleBreadcrumbs";
import { BibleNavProvider, NavBible } from "@/components/BibleNav";
import type { SidebarBook } from "@/utils/getSidebarBooks";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  params: {} as Record<string, string>,
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

const bibles: NavBible[] = [
  { id: KJV, name: "King James Version", abbreviation: "KJV", language: "English" },
  { id: DRA, name: "Douay-Rheims", abbreviation: "DRA", language: "English" },
];

const books: SidebarBook[] = [
  { id: "GEN", name: "Genesis", chapters: [{ id: "GEN.1", number: "1" }] },
];

const Provider = ({ children }: { children: ReactNode }) => (
  <BibleNavProvider bibleId={KJV} bibles={bibles} books={books}>
    {children}
  </BibleNavProvider>
);

const renderCrumbs = (pathname: string, params: Record<string, string> = {}) => {
  navigation.pathname = pathname;
  navigation.params = params;
  return render(
    <div>
      <p>Outside</p>
      <BibleBreadcrumbs fallback={<p>Fallback</p>} />
    </div>,
    { wrapper: Provider },
  );
};

beforeEach(() => {
  navigation.push.mockClear();
  navigation.replace.mockClear();
  navigation.refresh.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  );
});

describe("BibleBreadcrumbs", () => {
  it("shows the fallback on a page that is not part of a Bible", () => {
    navigation.pathname = "/about";
    render(<BibleBreadcrumbs fallback={<p>Fallback</p>} />);
    expect(screen.getByText("Fallback")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows Home, the Bible and the reference", () => {
    renderCrumbs(`/bibles/${KJV}/verses/GEN.1.1`, { verseId: "GEN.1.1" });
    const crumbs = screen.getByRole("navigation", { name: "Location" });

    expect(within(crumbs).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(crumbs).getByRole("button", { name: "Bible: KJV" })).toBeInTheDocument();
    expect(
      within(crumbs).getByRole("button", { name: "Reference: Genesis 1:1" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fallback")).not.toBeInTheDocument();
  });

  it.each([
    ["the Bible page", "", undefined],
    ["the books list", "/books", "Books"],
    ["the chapters list of a book", "/books/GEN/chapters", "Chapters"],
    ["the sections list of a book", "/books/GEN/sections", "Sections"],
    ["the verses list of a chapter", "/chapters/GEN.1/verses", "Verses"],
    ["a book", "/books/GEN", undefined],
    ["a chapter", "/chapters/GEN.1", undefined],
    ["the search page", "/search", "Search"],
    ["a section", "/sections/GEN.S1", "Section GEN.S1"],
    ["a section with an encoded ID", "/sections/GEN%2ES1", "Section GEN.S1"],
    ["an unknown page", "/other", undefined],
  ])("names %s at the end", (_name, path, name) => {
    renderCrumbs(`/bibles/${KJV}${path}`);
    const crumbs = screen.getByRole("navigation", { name: "Location" });
    const last = crumbs.lastElementChild;

    if (name) {
      expect(last).toHaveTextContent(name);
      expect(last?.tagName).toBe("P");
    } else {
      //The reference picker is the last crumb
      expect(last?.tagName).toBe("DIV");
    }
  });

  it("puts a divider between the crumbs", () => {
    renderCrumbs(`/bibles/${KJV}/search`);
    const crumbs = screen.getByRole("navigation", { name: "Location" });
    expect(crumbs.querySelectorAll("svg.lucide-chevron-right")).toHaveLength(3);
  });

  describe("Bible picker", () => {
    const openBibles = async () => {
      const user = userEvent.setup();
      renderCrumbs(`/bibles/${KJV}/chapters/GEN.1`, { chapterId: "GEN.1" });
      await user.click(screen.getByRole("button", { name: "Bible: KJV" }));
      expect(screen.getByRole("listbox", { name: "Bible" })).toBeInTheDocument();
      return user;
    };

    it("closes with Escape and leaves the page as it was", async () => {
      const user = await openBibles();
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bible: KJV" })).toBeInTheDocument();
      expect(navigation.push).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("closes on a click out of it and leaves the page as it was", async () => {
      const user = await openBibles();
      await user.click(screen.getByText("Outside"));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(navigation.push).not.toHaveBeenCalled();
    });

    it("closes on a click on the reference and opens the reference form", async () => {
      const user = await openBibles();
      await user.click(screen.getByRole("button", { name: "Reference: Genesis 1" }));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Book" })).toBeInTheDocument();
      expect(navigation.push).not.toHaveBeenCalled();
    });

    it("opens the page of the selected Bible", async () => {
      const user = await openBibles();
      await user.click(screen.getByText("Douay-Rheims"));
      expect(navigation.push).toHaveBeenCalledExactlyOnceWith(`/bibles/${DRA}`);
    });

    it("links to the list of all Bibles", async () => {
      const user = await openBibles();
      await user.click(screen.getByText("Open the Bibles page"));
      expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/bibles");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});

describe("RouteHero", () => {
  const tips = () =>
    screen.queryAllByRole("tooltip", { hidden: true }).map((tip) => tip.textContent);

  it("shows the route of the page as a GET request", () => {
    navigation.pathname = `/bibles/${KJV}/verses/GEN.1.1`;
    render(<RouteHero />);
    const heading = screen.getByRole("heading", {
      name: `GET /bibles/${KJV}/verses/GEN.1.1`,
    });
    //Each part is a focusable span, before its tip
    const parts = Array.from(heading.querySelectorAll("[tabindex='0']")).map(
      (part) => part.textContent,
    );
    expect(parts).toEqual(["bibles", KJV, "verses", "GEN.1.1"]);
  });

  it("gives each ID its placeholder name and description", () => {
    navigation.pathname = `/bibles/${KJV}/verses/GEN.1.1`;
    render(<RouteHero />);
    const [, bibleTip, , verseTip] = tips();

    expect(bibleTip).toMatch(/^\{bibleId\}./);
    expect(verseTip).toMatch(/^\{verseId\}./);
  });

  it("gives each word a definition", () => {
    navigation.pathname = `/bibles/${KJV}/verses/GEN.1.1`;
    render(<RouteHero />);
    const [biblesTip, , versesTip] = tips();

    expect(biblesTip).toMatch(/Bible object represents/);
    expect(versesTip).toMatch(/Verse object represents/);
  });

  it("gives the focus to each part with a tip", async () => {
    navigation.pathname = `/bibles/${KJV}`;
    const user = userEvent.setup();
    render(<RouteHero />);
    await user.tab();
    expect(screen.getByText("bibles")).toHaveFocus();
    await user.tab();
    expect(screen.getByText(KJV)).toHaveFocus();
  });

  it("shows parts with no tip as plain text", () => {
    navigation.pathname = "/unknown/part%20two";
    render(<RouteHero />);
    expect(tips()).toEqual([]);
    expect(screen.getByRole("heading")).toHaveTextContent("GET/unknown/part two");
  });

  it("shows an ID with no description when the route is not in the reference", () => {
    navigation.pathname = `/bibles/${KJV}/unknown`;
    render(<RouteHero />);
    expect(tips()).toContain("{bibleId}");
  });

  it("does not treat a word in an even position as an ID", () => {
    navigation.pathname = "/x/bibles/bibles";
    render(<RouteHero />);
    expect(tips().some((tip) => tip?.startsWith("{"))).toBe(false);
  });
});
