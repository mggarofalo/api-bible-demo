import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageLoader from "@/components/PageLoader";

describe("PageLoader", () => {
  //The loader has no text, role or label, so the class is the only sign that it turns
  it("shows one spinning icon", () => {
    const { container } = render(<PageLoader />);
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass("animate-spin");
  });
});
