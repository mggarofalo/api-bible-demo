import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page } from "@/components/Page";

describe("Page", () => {
  it("wraps all its children in one full-width column", () => {
    const { container } = render(
      <Page>
        <p>first</p>
        <p>second</p>
      </Page>,
    );
    const wrapper = container.firstElementChild;
    expect(container.childElementCount).toBe(1);
    expect(wrapper).toHaveClass("w-full", "flex", "flex-col");
    expect(wrapper).toContainElement(screen.getByText("first"));
    expect(wrapper).toContainElement(screen.getByText("second"));
  });
});
