import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextSection } from "@/components/sections/TextSection";

describe("TextSection", () => {
  it("renders its children", () => {
    render(
      <TextSection>
        <p>hello</p>
      </TextSection>,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("adds a class name when given", () => {
    render(<TextSection className="extra">x</TextSection>);
    expect(screen.getByText("x")).toHaveClass("extra");
  });
});
