import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkButton } from "@/components/LinkButton";

describe("LinkButton", () => {
  it("renders a link with the title and href", () => {
    render(<LinkButton title="Docs" href="https://docs.api.bible" />);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://docs.api.bible",
    );
  });

  it("shows the external icon only when external", () => {
    const { container, rerender } = render(<LinkButton title="A" href="/a" />);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    rerender(<LinkButton title="A" href="/a" external />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("renders children and omits the title text when the title is empty", () => {
    render(
      <LinkButton title="" href="/a">
        <b>icon</b>
      </LinkButton>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("icon");
    expect(link.querySelectorAll("span")).toHaveLength(0);
  });

  it("uses the tab style when tab is set", () => {
    render(<LinkButton title="Tab" href="/t" tab className="extra" />);
    const link = screen.getByRole("link", { name: "Tab" });
    expect(link).toHaveClass("folder-tab", "extra");
  });

  it("uses the button style when tab is not set", () => {
    render(<LinkButton title="Btn" href="/t" />);
    expect(screen.getByRole("link", { name: "Btn" })).not.toHaveClass(
      "folder-tab",
    );
  });
});
