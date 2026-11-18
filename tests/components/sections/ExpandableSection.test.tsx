import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ExpandableSection } from "@/components/sections/ExpandableSection";

describe("ExpandableSection", () => {
  it("is collapsed by default", () => {
    const { container } = render(
      <ExpandableSection title="Request">body text</ExpandableSection>,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("is open when defaultOpen is set", () => {
    const { container } = render(
      <ExpandableSection title="Request" defaultOpen>
        body text
      </ExpandableSection>,
    );
    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("opens and closes when the title is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ExpandableSection title="Request">body text</ExpandableSection>,
    );
    const details = container.querySelector("details")!;
    await user.click(screen.getByText("Request"));
    expect(details.open).toBe(true);
    await user.click(screen.getByText("Request"));
    expect(details.open).toBe(false);
  });

  it("shows the summary and the id when given", () => {
    const { container } = render(
      <ExpandableSection title="Response" summary={<span>200 OK</span>} id="resp">
        body
      </ExpandableSection>,
    );
    expect(screen.getByText("200 OK")).toBeInTheDocument();
    expect(container.querySelector("details")).toHaveAttribute("id", "resp");
  });

  it("omits the summary when not given", () => {
    render(<ExpandableSection title="Response">body</ExpandableSection>);
    expect(screen.queryByText("200 OK")).toBeNull();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
