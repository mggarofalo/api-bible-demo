import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spacer } from "@/components/Spacer";

describe("Spacer", () => {
  it("renders one element", () => {
    const { container } = render(<Spacer />);
    expect(container.childElementCount).toBe(1);
  });
});
