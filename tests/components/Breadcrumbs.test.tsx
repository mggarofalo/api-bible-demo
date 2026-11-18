import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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

describe("Breadcrumbs", () => {
  it("renders items with an href as links", () => {
    render(
      <Breadcrumbs
        items={[
          { title: "Home", href: "/" },
          { title: "Bibles", href: "/bibles" },
          { title: "Current" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Bibles" })).toHaveAttribute(
      "href",
      "/bibles",
    );
  });

  it("never prefetches a link, so hovering does not call the API", () => {
    render(
      <Breadcrumbs
        items={[
          { title: "Home", href: "/" },
          { title: "Bibles", href: "/bibles" },
        ]}
      />,
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("renders an item without an href as plain text", () => {
    render(
      <Breadcrumbs items={[{ title: "Home", href: "/" }, { title: "Here" }]} />,
    );
    expect(screen.getByText("Here")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Here" })).toBeNull();
  });

  it("puts a separator between items but not after the last one", () => {
    const { container } = render(
      <Breadcrumbs items={[{ title: "A", href: "/a" }, { title: "B" }]} />,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("shows a separator after a single item", () => {
    const { container } = render(<Breadcrumbs items={[{ title: "Only" }]} />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("renders nothing inside when the list is empty", () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.querySelectorAll("a, p, svg")).toHaveLength(0);
  });
});
