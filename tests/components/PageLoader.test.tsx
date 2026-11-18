import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageLoader from "@/components/PageLoader";

describe("PageLoader", () => {
  it("is a status with the name Loading", () => {
    render(<PageLoader />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("hides its spinning icon from screen readers", () => {
    render(<PageLoader />);
    const icon = screen.getByRole("status").querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    //The class is the only sign that the icon turns
    expect(icon).toHaveClass("animate-spin");
  });
});
