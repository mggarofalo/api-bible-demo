import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/bibles";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const findEndpoint = vi.fn();
vi.mock("@/utils/apiReference", () => ({
  findEndpoint: (path: string) => findEndpoint(path),
}));

import { InfoSection } from "@/components/sections/InfoSection";

const found = {
  path: "/bibles",
  endpoint: { summary: "List Bibles", description: "Returns **all** Bibles." },
};

describe("InfoSection", () => {
  beforeEach(() => {
    pathname = "/bibles";
    findEndpoint.mockReturnValue(found);
  });

  afterEach(() => {
    delete document.documentElement.dataset.help;
  });

  it("shows the endpoint summary, URL and description from the reference", () => {
    render(<InfoSection />);
    expect(findEndpoint).toHaveBeenCalledWith("/bibles");
    expect(screen.getByRole("heading", { name: "List Bibles" })).toBeInTheDocument();
    expect(screen.getByText("https://rest.api.bible/v1/bibles")).toBeInTheDocument();
    expect(screen.getByText("all").tagName).toBe("B");
  });

  it("prefers the given request URL, then the given url", () => {
    const { rerender } = render(
      <InfoSection requestUrl="https://rest.api.bible/v1/bibles?x=1" url="https://u.test" />,
    );
    expect(screen.getByText("https://rest.api.bible/v1/bibles?x=1")).toBeInTheDocument();
    rerender(<InfoSection url="https://u.test" />);
    expect(screen.getByText("https://u.test")).toBeInTheDocument();
  });

  it("uses a given title and info, and skips the reference", () => {
    render(<InfoSection title="Welcome" info={<p>custom info</p>} />);
    expect(findEndpoint).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("custom info")).toBeInTheDocument();
    //No URL anywhere, so no URL block
    expect(screen.queryByTitle("Copy the URL")).toBeNull();
  });

  it("renders nothing when there is no title and no endpoint", () => {
    findEndpoint.mockReturnValue(undefined);
    const { container } = render(<InfoSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows no body when the endpoint has no description", () => {
    findEndpoint.mockReturnValue({
      path: "/bibles",
      endpoint: { summary: "List Bibles" },
    });
    render(<InfoSection />);
    expect(screen.getByRole("heading", { name: "List Bibles" })).toBeInTheDocument();
    expect(screen.queryByText("Returns")).toBeNull();
  });

  it("collapses and expands, storing the flag and the page attribute", async () => {
    const user = userEvent.setup();
    render(<InfoSection />);
    const toggle = screen.getByRole("button", { name: /List Bibles/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("help-collapsed")).toBe("true");
    expect(document.documentElement.dataset.help).toBe("collapsed");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("help-collapsed")).toBe("false");
    expect(document.documentElement.dataset.help).toBe("shown");
  });

  it("starts collapsed when the stored flag is true", () => {
    localStorage.setItem("help-collapsed", "true");
    render(<InfoSection />);
    expect(screen.getByRole("button", { name: /List Bibles/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("copies the URL and shows a check for a moment", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    //Set after userEvent.setup, which installs its own clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<InfoSection />);
    const icon = screen.getByTitle("Copy the URL").querySelector("svg")!;
    await user.click(icon);
    expect(writeText).toHaveBeenCalledWith("https://rest.api.bible/v1/bibles");
    await waitFor(() =>
      expect(screen.getByTitle("Copy the URL").querySelector("svg")).not.toHaveClass(
        "cursor-pointer",
      ),
    );
  });

  it("returns the copy icon after two seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
      });
      render(<InfoSection />);
      await user.click(screen.getByTitle("Copy the URL").querySelector("svg")!);
      await waitFor(() =>
        expect(screen.getByTitle("Copy the URL").querySelector("svg")).not.toHaveClass(
          "cursor-pointer",
        ),
      );
      await vi.advanceTimersByTimeAsync(2100);
      await waitFor(() =>
        expect(screen.getByTitle("Copy the URL").querySelector("svg")).toHaveClass(
          "cursor-pointer",
        ),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
