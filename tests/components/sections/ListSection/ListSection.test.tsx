import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSection } from "@/components/sections/ListSection/ListSection";

const items = [
  { title: "One", href: "/one" },
  { title: "Two", href: "/two", info: "second" },
];

describe("ListSection", () => {
  it("renders a link for each item, with the default title and count", () => {
    render(<ListSection items={items} />);
    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5 })).toHaveTextContent("2");
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(
      ["/one", "/two"],
    );
  });

  it("shows the info of each item and no empty message", () => {
    render(<ListSection items={items} />);
    expect(screen.getByText("second")).toBeInTheDocument();
    //The item without info shows the default hint
    expect(screen.getAllByText("Click to open")).toHaveLength(1);
    expect(
      screen.queryByText("This list has no items for this Bible."),
    ).not.toBeInTheDocument();
  });

  it("uses a custom title", () => {
    render(<ListSection title="Books" items={items} />);
    expect(screen.getByRole("heading", { name: "Books" })).toBeInTheDocument();
  });

  it("hides the header when hideHeader is set", () => {
    render(<ListSection hideHeader items={items} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows an empty message when there are no items", () => {
    render(<ListSection items={[]} />);
    expect(
      screen.getByText("This list has no items for this Bible."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { level: 5 })).toHaveTextContent("0");
  });
});
