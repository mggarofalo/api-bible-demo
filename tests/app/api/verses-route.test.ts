import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());

vi.mock("@/utils/api", () => ({ client: { verses: { list } } }));

const verse = (id: string) => ({
  id,
  bibleId: "bible-1",
  bookId: id.split(".")[0],
  chapterId: id.split(".").slice(0, 2).join("."),
});

//Loads a new copy of the route, so the chapters it keeps in memory start empty
const load = async () => {
  vi.resetModules();
  const { GET } = await import(
    "@/app/api/bibles/[bibleId]/chapters/[chapterId]/verses/route"
  );
  return (bibleId: string, chapterId: string) =>
    GET(
      new Request(
        `http://localhost/api/bibles/${bibleId}/chapters/${chapterId}/verses`,
      ),
      { params: Promise.resolve({ bibleId, chapterId }) },
    );
};

beforeEach(() => {
  list.mockReset();
});

describe("GET verses of a chapter", () => {
  it("returns the ID and number of each verse", async () => {
    list.mockResolvedValue({
      data: [verse("GEN.1.1"), verse("GEN.1.2"), verse("GEN.1.10")],
    });
    const get = await load();

    const response = await get("bible-1", "GEN.1");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual([
      { id: "GEN.1.1", number: "1" },
      { id: "GEN.1.2", number: "2" },
      { id: "GEN.1.10", number: "10" },
    ]);
    expect(list).toHaveBeenCalledWith("bible-1", "GEN.1");
  });

  it("returns an empty list for a chapter without verses", async () => {
    list.mockResolvedValue({ data: [] });
    const get = await load();

    const response = await get("bible-1", "GEN.intro");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("uses the full ID as the number of a verse ID without dots", async () => {
    list.mockResolvedValue({ data: [verse("GEN")] });
    const get = await load();

    const response = await get("bible-1", "GEN.1");

    await expect(response.json()).resolves.toEqual([{ id: "GEN", number: "GEN" }]);
  });

  it("calls the API one time for each chapter", async () => {
    list.mockResolvedValue({ data: [verse("GEN.1.1")] });
    const get = await load();

    await get("bible-1", "GEN.1");
    const again = await get("bible-1", "GEN.1");
    await get("bible-1", "GEN.2");
    await get("bible-2", "GEN.1");

    await expect(again.json()).resolves.toEqual([{ id: "GEN.1.1", number: "1" }]);
    expect(list).toHaveBeenCalledTimes(3);
  });

  it("returns a 502 error when the API call fails", async () => {
    list.mockRejectedValue(new Error("API down"));
    const get = await load();

    const response = await get("bible-1", "GEN.1");

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to list verses for this chapter.",
    });
  });

  it("tries again after a failed request", async () => {
    list
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce({ data: [verse("GEN.1.1")] });
    const get = await load();

    expect((await get("bible-1", "GEN.1")).status).toBe(502);
    const response = await get("bible-1", "GEN.1");

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("forgets all chapters when it keeps too many", async () => {
    list.mockResolvedValue({ data: [] });
    const get = await load();

    //The route keeps up to 2000 chapters
    for (let chapter = 1; chapter <= 2000; chapter++) {
      await get("bible-1", `GEN.${chapter}`);
    }
    await get("bible-1", "GEN.1");
    expect(list).toHaveBeenCalledTimes(2000);

    await get("bible-1", "GEN.2001");
    await get("bible-1", "GEN.1");

    expect(list).toHaveBeenCalledTimes(2002);
  });
});
