import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HELP_COLLAPSED_KEY,
  INITIAL_SETTINGS_SCRIPT,
  NavControls,
} from "@/components/NavControls";

const root = document.documentElement;

describe("NavControls", () => {
  afterEach(() => {
    root.classList.remove("dark");
    delete root.dataset.colorMode;
    delete root.dataset.help;
  });

  it("offers the dark theme when the page is light", () => {
    render(<NavControls />);
    expect(
      screen.getByRole("button", { name: "Use the dark theme" }),
    ).toBeInTheDocument();
  });

  it("switches to dark, stores the choice and sets the page attributes", async () => {
    const user = userEvent.setup();
    render(<NavControls />);
    await user.click(screen.getByRole("button", { name: "Use the dark theme" }));
    expect(root).toHaveClass("dark");
    expect(root.dataset.colorMode).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Use the light theme" }),
    ).toBeInTheDocument();
  });

  it("switches back to light", async () => {
    const user = userEvent.setup();
    root.classList.add("dark");
    render(<NavControls />);
    await user.click(
      screen.getByRole("button", { name: "Use the light theme" }),
    );
    expect(root).not.toHaveClass("dark");
    expect(root.dataset.colorMode).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("still switches when storage throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<NavControls />);
    await user.click(screen.getByRole("button", { name: "Use the dark theme" }));
    expect(root).toHaveClass("dark");
  });

  describe("initial settings script", () => {
    const run = () => new Function(INITIAL_SETTINGS_SCRIPT)();

    it("uses the stored theme", () => {
      localStorage.setItem("theme", "dark");
      run();
      expect(root).toHaveClass("dark");
      expect(root.dataset.colorMode).toBe("dark");
    });

    it("falls back to the system setting when nothing is stored", () => {
      vi.stubGlobal("matchMedia", () => ({ matches: true }));
      run();
      expect(root.dataset.colorMode).toBe("dark");
    });

    it("lets a stored light theme win over a dark system", () => {
      localStorage.setItem("theme", "light");
      vi.stubGlobal("matchMedia", () => ({ matches: true }));
      run();
      expect(root.dataset.colorMode).toBe("light");
    });

    it("marks the help cards collapsed or shown", () => {
      vi.stubGlobal("matchMedia", () => ({ matches: false }));
      run();
      expect(root.dataset.help).toBe("shown");
      localStorage.setItem(HELP_COLLAPSED_KEY, "true");
      run();
      expect(root.dataset.help).toBe("collapsed");
    });

    it("does not throw when storage is not available", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(run).not.toThrow();
    });
  });
});
