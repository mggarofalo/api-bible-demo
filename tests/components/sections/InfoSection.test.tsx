import { act, fireEvent, render, screen } from "@testing-library/react";
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

//A fake clipboard that records the copied text
const mockClipboard = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
};

describe("InfoSection", () => {
  beforeEach(() => {
    pathname = "/bibles";
    findEndpoint.mockReturnValue(found);
  });

  afterEach(() => {
    delete document.documentElement.dataset.help;
    vi.useRealTimers();
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
    expect(screen.queryByRole("button", { name: "Copy the URL" })).toBeNull();
  });

  it("shows the given info instead of the description when there is no title", () => {
    render(<InfoSection info={<p>custom info</p>} />);
    //The heading and the URL still come from the reference
    expect(screen.getByRole("heading", { name: "List Bibles" })).toBeInTheDocument();
    expect(screen.getByText("https://rest.api.bible/v1/bibles")).toBeInTheDocument();
    expect(screen.getByText("custom info")).toBeInTheDocument();
    expect(screen.queryByText("all")).toBeNull();
    expect(screen.queryByText(/Returns/)).toBeNull();
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

  it("copies the URL with the copy button, which then says Copied", async () => {
    const user = userEvent.setup();
    //Set after userEvent.setup, which installs its own clipboard
    const writeText = mockClipboard();
    render(<InfoSection />);
    await user.click(screen.getByRole("button", { name: "Copy the URL" }));
    expect(writeText).toHaveBeenCalledWith("https://rest.api.bible/v1/bibles");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy the URL" })).toBeNull();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("copies the URL with the %s key", async (_name, key) => {
    const user = userEvent.setup();
    const writeText = mockClipboard();
    render(<InfoSection />);
    screen.getByRole("button", { name: "Copy the URL" }).focus();
    await user.keyboard(key);
    expect(writeText).toHaveBeenCalledWith("https://rest.api.bible/v1/bibles");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("says Copied for exactly two seconds", async () => {
    vi.useFakeTimers();
    mockClipboard();
    render(<InfoSection />);
    //The async act lets the copy finish before the timer starts
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy the URL" }));
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "Copy the URL" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
  });
});
