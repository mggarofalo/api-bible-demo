import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListItem } from "@/components/sections/ListSection/ListItem";

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

describe("ListItem", () => {
  it("links to the href and shows the title and info", () => {
    render(<ListItem title="Genesis" href="/bibles/b/books/GEN" info="50 chapters" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bibles/b/books/GEN");
    expect(link).toHaveTextContent("Genesis");
    expect(link).toHaveTextContent("50 chapters");
  });

  it("never prefetches the link, so hovering does not call the API", () => {
    render(<ListItem title="Genesis" href="/x" />);
    expect(screen.getByRole("link")).toHaveAttribute("data-prefetch", "false");
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
