import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BibleScopeSwitch, useBibleScope } from "@/components/BibleScope";

const nav = vi.hoisted(() => ({
  router: { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() },
  pathname: "/",
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const button = (name: string) => screen.getByRole("button", { name });

describe("BibleScopeSwitch", () => {
  beforeEach(() => {
    nav.pathname = "/";
    nav.search = "";
  });

  it("shows the selected scope when there is no cookie", () => {
    render(<BibleScopeSwitch />);
    expect(screen.getByRole("group", { name: "Bibles in the lists" })).toBeInTheDocument();
    expect(button("Selected")).toHaveAttribute("aria-pressed", "true");
    expect(button("All")).toHaveAttribute("aria-pressed", "false");
  });

  it("reads the scope from the cookie", () => {
    document.cookie = "bible-scope=all; path=/";
    render(<BibleScopeSwitch initialScope="selected" />);
    expect(button("All")).toHaveAttribute("aria-pressed", "true");
    expect(button("Selected")).toHaveAttribute("aria-pressed", "false");
  });

  it("treats an unknown cookie value as the selected scope", () => {
    document.cookie = "bible-scope=nonsense; path=/";
    render(<BibleScopeSwitch />);
    expect(button("Selected")).toHaveAttribute("aria-pressed", "true");
  });

  it("writes the cookie and refreshes the router when the user picks All", async () => {
    const user = userEvent.setup();
    render(<BibleScopeSwitch />);

    await user.click(button("All"));

    expect(document.cookie).toContain("bible-scope=all");
    expect(nav.router.refresh).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).not.toHaveBeenCalled();
    expect(button("All")).toHaveAttribute("aria-pressed", "true");
    expect(button("Selected")).toHaveAttribute("aria-pressed", "false");
  });

  it("writes the cookie for the whole site, for one year, with samesite lax", async () => {
    //document.cookie hides the attributes when it is read, so watch what is written
    const write = vi.spyOn(document, "cookie", "set");
    const user = userEvent.setup();
    render(<BibleScopeSwitch />);

    await user.click(button("All"));

    expect(write).toHaveBeenCalledExactlyOnceWith(
      "bible-scope=all; path=/; max-age=31536000; samesite=lax",
    );
    write.mockRestore();
  });

  it("switches back to the selected scope", async () => {
    document.cookie = "bible-scope=all; path=/";
    const user = userEvent.setup();
    render(<BibleScopeSwitch />);

    await user.click(button("Selected"));

    expect(document.cookie).toContain("bible-scope=selected");
    expect(nav.router.refresh).toHaveBeenCalledTimes(1);
    expect(button("Selected")).toHaveAttribute("aria-pressed", "true");
  });

  it("does nothing when the user picks the scope that is already active", async () => {
    const user = userEvent.setup();
    render(<BibleScopeSwitch />);

    await user.click(button("Selected"));

    expect(document.cookie).toBe("");
    expect(nav.router.refresh).not.toHaveBeenCalled();
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it("removes the ids value from the URL on the Bibles page", async () => {
    nav.pathname = "/bibles";
    nav.search = "ids=a,b&page=2";
    const user = userEvent.setup();
    render(<BibleScopeSwitch />);

    await user.click(button("All"));

    expect(nav.router.replace).toHaveBeenCalledWith("/bibles?page=2", { scroll: false });
    expect(nav.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("uses the bare path when ids was the only query value", async () => {
    nav.pathname = "/bibles";
    nav.search = "ids=a";
    const user = userEvent.setup();
    render(<BibleScopeSwitch />);

    await user.click(button("All"));

    expect(nav.router.replace).toHaveBeenCalledWith("/bibles", { scroll: false });
  });

  it("uses the scope from the server for the first render", () => {
    //The server render has no cookie, so the initial scope decides
    document.cookie = "bible-scope=selected; path=/";
    const html = renderToString(<BibleScopeSwitch initialScope="all" />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>All</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Selected</);
  });

  it("falls back to the selected scope on the server without an initial scope", () => {
    const html = renderToString(<BibleScopeSwitch />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Selected</);
  });

  it("keeps the focus in a filter box by cancelling mouse down", () => {
    render(<BibleScopeSwitch className="extra" />);
    const prevented = !button("All").dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    expect(prevented).toBe(true);
    expect(screen.getByRole("group")).toHaveClass("extra");
  });
});

describe("useBibleScope", () => {
  const Probe = () => {
    const [scope, setScope] = useBibleScope();
    return (
      <button type="button" onClick={() => setScope("all")}>
        {`scope:${scope}`}
      </button>
    );
  };

  it("updates every component that uses the hook", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Probe />
        <BibleScopeSwitch />
      </>,
    );
    expect(screen.getByText("scope:selected")).toBeInTheDocument();

    await user.click(screen.getByText("scope:selected"));

    expect(screen.getByText("scope:all")).toBeInTheDocument();
    expect(button("All")).toHaveAttribute("aria-pressed", "true");
  });

  it("removes its window listener when the component unmounts", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Probe />);
    const added = add.mock.calls.filter(([type]) => type === "bible-scope-change");
    expect(added).toHaveLength(1);
    const handler = added[0][1];
    expect(remove).not.toHaveBeenCalledWith("bible-scope-change", handler);

    unmount();

    expect(remove).toHaveBeenCalledWith("bible-scope-change", handler);
    add.mockRestore();
    remove.mockRestore();
  });
});
