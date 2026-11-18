import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/one";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { MobileNavbar } from "@/components/MobileNavBar";

const Menu = () => (
  <MobileNavbar>
    <p>menu items</p>
  </MobileNavbar>
);

describe("MobileNavbar", () => {
  beforeEach(() => {
    pathname = "/one";
    document.body.style.overflowY = "";
  });

  it("starts closed", () => {
    render(<Menu />);
    expect(screen.queryByText("menu items")).toBeNull();
    expect(document.body.style.overflowY).toBe("auto");
  });

  it("opens on click, names the open state and locks page scroll", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(screen.getByRole("button", { name: "Open the menu" }));
    expect(screen.getByText("menu items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close the menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Open the menu" })).toBeNull();
    expect(document.body.style.overflowY).toBe("hidden");
  });

  it("closes on a second click, names the closed state and unlocks scroll", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(screen.getByRole("button", { name: "Open the menu" }));
    await user.click(screen.getByRole("button", { name: "Close the menu" }));
    expect(screen.queryByText("menu items")).toBeNull();
    expect(screen.getByRole("button", { name: "Open the menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(document.body.style.overflowY).toBe("auto");
  });

  it("closes when the path changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Menu />);
    await user.click(screen.getByRole("button", { name: "Open the menu" }));
    expect(screen.getByText("menu items")).toBeInTheDocument();
    pathname = "/two";
    rerender(<Menu />);
    expect(screen.queryByText("menu items")).toBeNull();
    expect(screen.getByRole("button", { name: "Open the menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(document.body.style.overflowY).toBe("auto");
  });

  it("opens and closes from the keyboard, and names its state", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    const button = screen.getByRole("button", { name: "Open the menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    button.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("menu items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close the menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.keyboard(" ");
    expect(screen.queryByText("menu items")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open the menu" })).toBeInTheDocument();
  });
});
