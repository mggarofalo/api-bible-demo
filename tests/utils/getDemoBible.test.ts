import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  notFound: vi.fn(() => {
    //Like Next.js, stop the render
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/utils/api", () => ({
  client: { bibles: { list: mocks.list } },
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

const kjv = { id: "de4e12af7f28f599-02", name: "King James Version" };
const web = { id: "9879dbb7cfe39e4d-04", name: "World English Bible" };

//Loads a new copy of the module, so the Bibles it keeps in memory start empty
const load = async () => {
  vi.resetModules();
  return import("@/utils/getDemoBible");
};

beforeEach(() => {
  mocks.list.mockReset();
  mocks.notFound.mockClear();
});

describe("getBibles", () => {
  it("returns the Bibles from the API", async () => {
    mocks.list.mockResolvedValue({ data: [kjv, web] });
    const { getBibles } = await load();

    await expect(getBibles()).resolves.toEqual([kjv, web]);
    expect(mocks.list).toHaveBeenCalledWith();
  });

  it("calls the API one time for many calls", async () => {
    mocks.list.mockResolvedValue({ data: [kjv] });
    const { getBibles } = await load();

    const [first, second] = await Promise.all([getBibles(), getBibles()]);
    await getBibles();

    expect(first).toBe(second);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed request", async () => {
    mocks.list
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce({ data: [web] });
    const { getBibles } = await load();

    await expect(getBibles()).rejects.toThrow("API down");
    await expect(getBibles()).resolves.toEqual([web]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
});

describe("getDemoBible", () => {
  it("returns the Bible with the ID", async () => {
    mocks.list.mockResolvedValue({ data: [kjv, web] });
    const { getDemoBible } = await load();

    await expect(getDemoBible(web.id)).resolves.toBe(web);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("uses the Bibles in memory for each Bible", async () => {
    mocks.list.mockResolvedValue({ data: [kjv, web] });
    const { getDemoBible } = await load();

    await getDemoBible(kjv.id);
    await getDemoBible(web.id);

    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it("shows the not found page for an unknown Bible", async () => {
    mocks.list.mockResolvedValue({ data: [kjv] });
    const { getDemoBible } = await load();

    await expect(getDemoBible("not-a-bible")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("shows the not found page for the start of a real ID", async () => {
    mocks.list.mockResolvedValue({ data: [kjv, web] });
    const { getDemoBible } = await load();

    //The ID must match in full, not only at the start
    await expect(getDemoBible("de4e12af7f28f599")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the not found page when the API has no Bibles", async () => {
    mocks.list.mockResolvedValue({ data: [] });
    const { getDemoBible } = await load();

    await expect(getDemoBible(kjv.id)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("gives the error of a failed request, not the not found page", async () => {
    mocks.list.mockRejectedValue(new Error("API down"));
    const { getDemoBible } = await load();

    await expect(getDemoBible(kjv.id)).rejects.toThrow("API down");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
