import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FilterableListSection } from "@/components/sections/FilterableListSection";

const items = [
  { title: "King James", href: "/kjv", filterText: "King James Version KJV" },
  { title: "World English", href: "/web", filterText: "World English Bible WEB" },
  { title: "Reina Valera", href: "/rv", filterText: "Reina Valera español" },
];

describe("FilterableListSection", () => {
  it("shows all items before any text is typed", () => {
    render(<FilterableListSection filterLabel="Filter Bibles" items={items} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("searchbox", { name: "Filter Bibles" })).toHaveValue("");
  });

  it.each([
    ["a lowercase query", "mixed-case text", "english", "/web"],
    ["an uppercase query", "mixed-case text", "ENGLISH", "/web"],
    ["a lowercase query", "uppercase text", "kjv", "/kjv"],
    ["an uppercase query", "lowercase text", "ESPAÑOL", "/rv"],
  ])("matches %s against %s (%s)", async (_query, _text, typed, href) => {
    const user = userEvent.setup();
    render(<FilterableListSection filterLabel="Filter Bibles" items={items} />);
    await user.type(screen.getByRole("searchbox"), typed);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      href,
    ]);
  });

  it("requires every word to match", async () => {
    const user = userEvent.setup();
    render(<FilterableListSection filterLabel="Filter Bibles" items={items} />);
    await user.type(screen.getByRole("searchbox"), "  king   kjv ");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await user.type(screen.getByRole("searchbox"), "world");
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText("This list has no items for this Bible."),
    ).toBeInTheDocument();
  });

  it("shows everything again when the box is cleared", async () => {
    const user = userEvent.setup();
    render(<FilterableListSection filterLabel="Filter Bibles" items={items} />);
    await user.type(screen.getByRole("searchbox"), "reina");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("passes the title and the match count to the list", async () => {
    const user = userEvent.setup();
    render(
      <FilterableListSection title="Bibles" filterLabel="Filter" items={items} />,
    );
    expect(screen.getByRole("heading", { name: "Bibles" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "kjv");
    expect(screen.getByRole("heading", { level: 5 })).toHaveTextContent("1");
  });
});
