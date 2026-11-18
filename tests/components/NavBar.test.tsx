import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    //eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

import { Navbar } from "@/components/NavBar";

describe("Navbar", () => {
  it("links the logo to the home page", () => {
    render(<Navbar />);
    const logo = screen.getByRole("img", { name: "API.Bible" });
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("shows the theme button", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: /theme/ })).toBeInTheDocument();
  });

  it("shows the three external links", () => {
    render(<Navbar />);
    //The mobile menu is closed, so only the desktop links are in the page
    expect(screen.getByRole("link", { name: "Source Code" })).toHaveAttribute(
      "href",
      "https://github.com/americanbible/api-bible-demo",
    );
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "https://docs.api.bible",
    );
    expect(
      screen.getByRole("link", { name: "API.Bible Website" }),
    ).toHaveAttribute("href", "https://api.bible");
  });
});
