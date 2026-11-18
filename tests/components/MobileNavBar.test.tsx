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

  it("opens on click and locks page scroll", async () => {
    const user = userEvent.setup();
    const { container } = render(<Menu />);
    await user.click(container.querySelector("svg")!);
    expect(screen.getByText("menu items")).toBeInTheDocument();
    expect(document.body.style.overflowY).toBe("hidden");
  });

  it("closes on a second click and unlocks scroll", async () => {
    const user = userEvent.setup();
    const { container } = render(<Menu />);
    await user.click(container.querySelector("svg")!);
    await user.click(container.querySelector("svg")!);
    expect(screen.queryByText("menu items")).toBeNull();
    expect(document.body.style.overflowY).toBe("auto");
  });

  it("closes when the path changes", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<Menu />);
    await user.click(container.querySelector("svg")!);
    expect(screen.getByText("menu items")).toBeInTheDocument();
    pathname = "/two";
    rerender(<Menu />);
    expect(screen.queryByText("menu items")).toBeNull();
    expect(document.body.style.overflowY).toBe("auto");
  });
});
