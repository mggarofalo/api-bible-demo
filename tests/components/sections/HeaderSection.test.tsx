import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Bible } from "@americanbible/api-bible-sdk";

vi.mock("@/components/BibleBreadcrumbs", () => ({
  BibleBreadcrumbs: ({ fallback }: { fallback: React.ReactNode }) => (
    <div data-testid="bible-breadcrumbs">{fallback}</div>
  ),
  RouteHero: () => <h1>route hero</h1>,
}));
vi.mock("@/components/EndpointNav", () => ({
  EndpointNav: () => <nav>endpoint nav</nav>,
}));

import { HeaderSection } from "@/components/sections/HeaderSection";

const bible = { name: "World English Bible", abbreviation: "WEB" } as Bible;

describe("HeaderSection", () => {
  it("shows the title as a heading and the fallback breadcrumbs without a Bible", () => {
    render(
      <HeaderSection
        title="Bibles"
        breadcrumbs={[{ title: "Home", href: "/" }, { title: "Bibles" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Bibles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("route hero")).toBeNull();
    expect(screen.queryByText("endpoint nav")).toBeNull();
  });

  it("shows the route, Bible name and endpoint nav on a Bible page", () => {
    render(<HeaderSection bible={bible} title="Books" />);
    expect(screen.getByText("route hero")).toBeInTheDocument();
    expect(screen.getByText("World English Bible (WEB)")).toBeInTheDocument();
    expect(screen.getByText("endpoint nav")).toBeInTheDocument();
    //With the route, the title is plain text, not a heading
    expect(screen.getByText("Books").tagName).toBe("P");
  });

  it("shows the route for a page without a Bible when route is set", () => {
    render(<HeaderSection route title="Search" />);
    expect(screen.getByText("route hero")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Search" })).toBeNull();
    expect(screen.queryByText("endpoint nav")).toBeNull();
  });

  it("lets a Bible page turn the route off", () => {
    render(<HeaderSection bible={bible} route={false} title="Books" />);
    expect(screen.queryByText("route hero")).toBeNull();
    expect(screen.getByRole("heading", { name: "Books" })).toBeInTheDocument();
  });

  it("renders action links when given", () => {
    render(
      <HeaderSection
        title="Home"
        actionItems={[
          { title: "Guide", href: "/guide" },
          { title: "Docs", href: "https://docs.api.bible", external: true },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Guide" })).toHaveAttribute(
      "href",
      "/guide",
    );
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://docs.api.bible",
    );
  });

  it("passes the external and tab props on to the action links", () => {
    render(
      <HeaderSection
        title="Home"
        actionItems={[
          { title: "Plain", href: "/plain" },
          { title: "Outside", href: "https://docs.api.bible", external: true },
          { title: "Folder", href: "/folder", tab: true },
        ]}
      />,
    );
    const plain = screen.getByRole("link", { name: "Plain" });
    const outside = screen.getByRole("link", { name: "Outside" });
    const folder = screen.getByRole("link", { name: "Folder" });

    //Only the external link has the arrow icon
    expect(plain.querySelector("svg")).toBeNull();
    expect(outside.querySelector("svg")).not.toBeNull();
    expect(folder.querySelector("svg")).toBeNull();
    //Only the tab link has the folder tab style
    expect(folder).toHaveClass("folder-tab");
    expect(plain).not.toHaveClass("folder-tab");
    expect(outside).not.toHaveClass("folder-tab");
    //Every link gets the border from the header
    expect(plain).toHaveClass("border-[1px]");
  });

  it("renders no title and no actions when none are given", () => {
    render(<HeaderSection />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
