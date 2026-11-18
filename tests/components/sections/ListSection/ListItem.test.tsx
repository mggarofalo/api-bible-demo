import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListItem } from "@/components/sections/ListSection/ListItem";

describe("ListItem", () => {
  it("links to the href and shows the title and info", () => {
    render(<ListItem title="Genesis" href="/bibles/b/books/GEN" info="50 chapters" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bibles/b/books/GEN");
    expect(link).toHaveTextContent("Genesis");
    expect(link).toHaveTextContent("50 chapters");
  });

  it("shows a default hint when there is no info", () => {
    render(<ListItem title="Genesis" href="/x" />);
    expect(screen.getByText("Click to open")).toBeInTheDocument();
  });

  it("accepts an element as the title", () => {
    render(<ListItem title={<h4>Custom</h4>} href="/x" />);
    expect(screen.getByRole("heading", { name: "Custom" })).toBeInTheDocument();
  });
});
