import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spacer } from "@/components/Spacer";

describe("Spacer", () => {
  it("has its border on the right by default", () => {
    const { container } = render(<Spacer />);
    expect(container.firstElementChild).toHaveClass("border-r-[1px]");
    expect(container.firstElementChild).not.toHaveClass("border-l-[1px]");
  });

  it("has its border on the left when border is l", () => {
    const { container } = render(<Spacer border="l" />);
    expect(container.firstElementChild).toHaveClass("border-l-[1px]");
    expect(container.firstElementChild).not.toHaveClass("border-r-[1px]");
  });

  it("shows only from the small breakpoint up", () => {
    const { container } = render(<Spacer />);
    expect(container.firstElementChild).toHaveClass("hidden", "sm:block");
  });
});
