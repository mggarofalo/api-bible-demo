import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Code, Guide, Lead, Note } from "@/components/InfoText";

describe("InfoText", () => {
  it("Guide renders a link to the given href", () => {
    render(<Guide href="/guides/x">Read more</Guide>);
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "/guides/x",
    );
  });

  it("Code renders its text in a code element", () => {
    render(<Code>/bibles</Code>);
    expect(screen.getByText("/bibles").tagName).toBe("CODE");
  });

  it("Lead renders a paragraph", () => {
    render(<Lead>First words</Lead>);
    expect(screen.getByText("First words").tagName).toBe("P");
  });

  it("Note renders a paragraph that starts with Note:", () => {
    render(<Note>be careful</Note>);
    expect(screen.getByText(/be careful/)).toHaveTextContent(
      "Note: be careful",
    );
  });
});
