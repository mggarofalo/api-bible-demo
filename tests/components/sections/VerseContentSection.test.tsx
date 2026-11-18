import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chapter, Verse } from "@americanbible/api-bible-sdk";

const getBibles = vi.fn();
vi.mock("@/utils/getDemoBible", () => ({ getBibles: () => getBibles() }));

import { VerseContentSection } from "@/components/sections/VerseContentSection";

type Props = Parameters<typeof VerseContentSection>[0];

const make = (content: unknown, extra: Record<string, unknown> = {}) =>
  ({
    bibleId: "b1",
    content,
    verseCount: 3,
    ...extra,
  }) as unknown as Verse | Chapter;

const show = async (props: Props) => {
  const { container } = render(await VerseContentSection(props));
  return container;
};

describe("VerseContentSection", () => {
  beforeEach(() => {
    getBibles.mockReset();
    getBibles.mockResolvedValue([]);
  });

  it("shows the default title and a plural verse count", async () => {
    await show({ verseContent: make("In the beginning") });
    expect(screen.getByRole("heading", { name: "Verses" })).toBeInTheDocument();
    expect(screen.getByText("3 Verses")).toBeInTheDocument();
  });

  it("shows a singular verse count and a custom title", async () => {
    await show({
      title: "Genesis 1:1",
      verseContent: make("x", { verseCount: 1 }),
    });
    expect(screen.getByRole("heading", { name: "Genesis 1:1" })).toBeInTheDocument();
    expect(screen.getByText("1 Verse")).toBeInTheDocument();
  });

  it("shows a verse count of 0 as plural", async () => {
    await show({ verseContent: make("x", { verseCount: 0 }) });
    expect(screen.getByText("0 Verses")).toBeInTheDocument();
  });

  it("renders HTML content that starts with spaces and a line break as markup", async () => {
    const container = await show({
      verseContent: make('\n  <p class="p"><span>In the beginning</span></p>'),
    });
    expect(container.querySelector(".scripture-styles p span")).toHaveTextContent(
      "In the beginning",
    );
    expect(container.querySelector("pre")).toBeNull();
  });

  it("renders HTML content as markup", async () => {
    const container = await show({
      verseContent: make('<p class="p"><span>In the beginning</span></p>'),
    });
    expect(container.querySelector(".scripture-styles p span")).toHaveTextContent(
      "In the beginning",
    );
    expect(container.querySelector("pre")).toBeNull();
  });

  it("renders plain text content in a pre element", async () => {
    const container = await show({ verseContent: make("In the beginning") });
    expect(container.querySelector("pre")).toHaveTextContent("In the beginning");
    expect(container.querySelector(".scripture-styles")).toBeNull();
  });

  it("renders JSON content as formatted JSON", async () => {
    const content = [{ name: "para", items: [{ text: "hi" }] }];
    const container = await show({ verseContent: make(content) });
    expect(container.querySelector("pre")?.textContent).toBe(
      JSON.stringify(content, null, 2),
    );
  });

  it("shows no navigation links without linkBase", async () => {
    await show({
      verseContent: make("x", { previous: { id: "p" }, next: { id: "n" } }),
    });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names each previous and next link, and keeps the query in its href", async () => {
    await show({
      linkBase: "/bibles/b1/chapters",
      query: "?content-type=text",
      verseContent: make("x", {
        previous: { id: "GEN.1" },
        next: { id: "GEN.3" },
      }),
    });
    //Each link is there two times: an icon for small screens, and text for other screens
    const previous = screen.getAllByRole("link", { name: "Previous" });
    const next = screen.getAllByRole("link", { name: "Next" });
    expect(previous).toHaveLength(2);
    expect(next).toHaveLength(2);
    for (const link of previous) {
      expect(link).toHaveAttribute("href", "/bibles/b1/chapters/GEN.1?content-type=text");
    }
    for (const link of next) {
      expect(link).toHaveAttribute("href", "/bibles/b1/chapters/GEN.3?content-type=text");
    }
    //No link is without a name
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("leaves out a link when there is no previous or next id", async () => {
    await show({
      linkBase: "/b",
      verseContent: make("x", { previous: {}, next: { id: "n" } }),
    });
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    const next = screen.getAllByRole("link", { name: "Next" });
    expect(next).toHaveLength(2);
    for (const link of next) {
      expect(link).toHaveAttribute("href", "/b/n");
    }
  });

  it("does not load the list of Bibles without parallels", async () => {
    await show({ verseContent: make("x") });
    expect(getBibles).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { level: 4 })).toBeNull();
  });

  it("shows each parallel under the name of its Bible", async () => {
    getBibles.mockResolvedValue([
      { id: "b1", name: "World English Bible", abbreviation: "WEB" },
      { id: "b2", name: "King James", abbreviation: "KJV" },
    ]);
    const container = await show({
      verseContent: make("<p>main text</p>", {
        parallels: [
          { bibleId: "b2", content: "<p>parallel text</p>" },
          { bibleId: "zz", content: "plain parallel" },
        ],
      }),
    });
    const titles = screen
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["World English Bible (WEB)", "King James (KJV)", "zz"]);
    expect(container).toHaveTextContent("main text");
    expect(container).toHaveTextContent("parallel text");
    expect(container).toHaveTextContent("plain parallel");
  });
});
