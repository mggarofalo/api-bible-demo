import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());

vi.mock("@/utils/api", () => ({ client: { books: { list } } }));

const chapter = (id: string, number?: string) => ({
  id,
  bibleId: "bible-1",
  bookId: id.split(".")[0],
  ...(number === undefined ? {} : { number }),
});

const genesis = {
  id: "GEN",
  bibleId: "bible-1",
  abbreviation: "Gen",
  name: "Genesis",
  nameLong: "The First Book of Moses",
  chapters: [chapter("GEN.intro", "intro"), chapter("GEN.1", "1"), chapter("GEN.2", "2")],
};

//Loads a new copy of the module, so the books it keeps in memory start empty
const load = async () => {
  vi.resetModules();
  return import("@/utils/getSidebarBooks");
};

beforeEach(() => {
  list.mockReset();
});

describe("getSidebarBooks", () => {
  it("asks the API for the books with their chapters", async () => {
    list.mockResolvedValue({ data: [] });
    const { getSidebarBooks } = await load();

    await getSidebarBooks("bible-1");

    expect(list).toHaveBeenCalledWith("bible-1", { includeChapters: true });
  });

  it("keeps only the ID, name and chapters of each book", async () => {
    list.mockResolvedValue({ data: [genesis] });
    const { getSidebarBooks } = await load();

    await expect(getSidebarBooks("bible-1")).resolves.toEqual([
      {
        id: "GEN",
        name: "Genesis",
        chapters: [
          { id: "GEN.intro", number: "intro" },
          { id: "GEN.1", number: "1" },
          { id: "GEN.2", number: "2" },
        ],
      },
    ]);
  });

  it("uses the number of a chapter, not the end of its ID", async () => {
    list.mockResolvedValue({
      data: [{ ...genesis, id: "PSA", name: "Psalms", chapters: [chapter("PSA.1", "One")] }],
    });
    const { getSidebarBooks } = await load();

    const [book] = await getSidebarBooks("bible-1");

    expect(book.chapters).toEqual([{ id: "PSA.1", number: "One" }]);
  });

  it("keeps the order of the books and chapters from the API", async () => {
    list.mockResolvedValue({
      data: [
        { ...genesis, id: "REV", name: "Revelation", chapters: [chapter("REV.2", "2"), chapter("REV.1", "1")] },
        { ...genesis, id: "GEN", name: "Genesis", chapters: [] },
      ],
    });
    const { getSidebarBooks } = await load();

    const books = await getSidebarBooks("bible-1");

    expect(books.map(({ id }) => id)).toEqual(["REV", "GEN"]);
    expect(books[0].chapters.map(({ id }) => id)).toEqual(["REV.2", "REV.1"]);
  });

  it("takes the number of a chapter from its ID when it has no number", async () => {
    list.mockResolvedValue({
      data: [{ ...genesis, chapters: [chapter("GEN.3"), chapter("GEN")] }],
    });
    const { getSidebarBooks } = await load();

    const [book] = await getSidebarBooks("bible-1");

    expect(book.chapters).toEqual([
      { id: "GEN.3", number: "3" },
      { id: "GEN", number: "GEN" },
    ]);
  });

  it("gives the number of a chapter as text", async () => {
    list.mockResolvedValue({
      data: [{ ...genesis, chapters: [{ ...chapter("GEN.4"), number: 4 }] }],
    });
    const { getSidebarBooks } = await load();

    const [book] = await getSidebarBooks("bible-1");

    expect(book.chapters).toEqual([{ id: "GEN.4", number: "4" }]);
  });

  it("gives an empty list of chapters to a book without chapters", async () => {
    const noChapters: Partial<typeof genesis> = { ...genesis };
    delete noChapters.chapters;
    list.mockResolvedValue({ data: [noChapters] });
    const { getSidebarBooks } = await load();

    const [book] = await getSidebarBooks("bible-1");

    expect(book.chapters).toEqual([]);
  });

  it("calls the API one time for each Bible", async () => {
    list.mockResolvedValue({ data: [genesis] });
    const { getSidebarBooks } = await load();

    const [first, second] = await Promise.all([
      getSidebarBooks("bible-1"),
      getSidebarBooks("bible-1"),
    ]);
    await getSidebarBooks("bible-1");
    await getSidebarBooks("bible-2");

    expect(first).toBe(second);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenNthCalledWith(2, "bible-2", { includeChapters: true });
  });

  it("tries again after a failed request", async () => {
    list
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce({ data: [genesis] });
    const { getSidebarBooks } = await load();

    await expect(getSidebarBooks("bible-1")).rejects.toThrow("API down");
    const books = await getSidebarBooks("bible-1");

    expect(books).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("keeps the books of another Bible after a failed request", async () => {
    list
      .mockResolvedValueOnce({ data: [genesis] })
      .mockRejectedValueOnce(new Error("API down"));
    const { getSidebarBooks } = await load();

    await getSidebarBooks("bible-1");
    await expect(getSidebarBooks("bible-2")).rejects.toThrow("API down");
    await getSidebarBooks("bible-1");

    expect(list).toHaveBeenCalledTimes(2);
  });
});
