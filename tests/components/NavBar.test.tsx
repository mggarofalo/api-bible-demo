import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    //eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));
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

import { Navbar } from "@/components/NavBar";

const externalLinks = [
  ["Source Code, opens in a new window", "https://github.com/americanbible/api-bible-demo"],
  ["Documentation, opens in a new window", "https://docs.api.bible"],
  ["API.Bible Website, opens in a new window", "https://api.bible"],
];

describe("Navbar", () => {
  it("links the logo to the home page", () => {
    render(<Navbar />);
    const logo = screen.getByRole("img", { name: "API.Bible" });
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("never prefetches the logo link", () => {
    render(<Navbar />);
    const logo = screen.getByRole("img", { name: "API.Bible" });
    expect(logo.closest("a")).toHaveAttribute("data-prefetch", "false");
  });

  it("shows the theme button", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: /theme/ })).toBeInTheDocument();
  });

  it("shows the three external links", () => {
    render(<Navbar />);
    //The mobile menu is closed, so only the desktop links are in the page
    for (const [name, href] of externalLinks) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("shows the three external links again in the open mobile menu", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByRole("button", { name: "Open the menu" }));

    //Each link is now in the desktop bar and in the menu
    for (const [name, href] of externalLinks) {
      const links = screen.getAllByRole("link", { name });
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(link).toHaveAttribute("href", href);
        //The links open in a new window, as the icon of an external link shows
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link.querySelector("svg")).not.toBeNull();
      }
    }
  });
});
