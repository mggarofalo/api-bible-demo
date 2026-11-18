import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { JsonBodyLink, RAW_JSON_ID } from "@/components/sections/JsonBodyLink";

describe("JsonBodyLink", () => {
  it("links to the raw JSON section", () => {
    render(<JsonBodyLink />);
    expect(
      screen.getByRole("link", { name: "Raw JSON Output" }),
    ).toHaveAttribute("href", `#${RAW_JSON_ID}`);
  });

  it("opens the raw JSON section when clicked", async () => {
    const user = userEvent.setup();
    render(
      <>
        <JsonBodyLink />
        <details id={RAW_JSON_ID} data-testid="raw">
          <summary>Raw</summary>
        </details>
      </>,
    );
    const details = screen.getByTestId("raw") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(screen.getByRole("link"));
    expect(details.open).toBe(true);
  });

  it("does nothing when the section is not on the page", async () => {
    const user = userEvent.setup();
    render(<JsonBodyLink />);
    await user.click(screen.getByRole("link"));
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("does nothing when the element with that id is not a details element", async () => {
    const user = userEvent.setup();
    render(
      <>
        <JsonBodyLink />
        <div id={RAW_JSON_ID} data-testid="other" />
      </>,
    );
    await user.click(screen.getByRole("link"));
    expect(screen.getByTestId("other")).not.toHaveAttribute("open");
  });
});
