import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageLoader from "@/components/PageLoader";

describe("PageLoader", () => {
  it("renders a spinner", () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
