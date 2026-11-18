import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiKeyNotice } from "@/components/ApiKeyNotice";

describe("ApiKeyNotice", () => {
  it("is a region with the name of its title", () => {
    render(<ApiKeyNotice />);
    const notice = screen.getByRole("region", {
      name: "The API key is not set",
    });
    expect(
      within(notice).getByRole("heading", { name: "The API key is not set" }),
    ).toBeInTheDocument();
  });

  it("gives the steps to set the key", () => {
    render(<ApiKeyNotice />);
    const steps = screen.getAllByRole("listitem").map((step) => step.textContent);
    expect(steps).toEqual([
      "Copy the .env.example file to a new file with the name .env.",
      "In the .env file, set API_BIBLE_API_KEY to your API key.",
      "Stop the application, then start it again.",
    ]);
  });

  it("links to the authentication guide", () => {
    render(<ApiKeyNotice />);
    expect(
      screen.getByRole("link", { name: "authentication guide" }),
    ).toHaveAttribute(
      "href",
      "https://docs.api.bible/quick-start/authentication",
    );
  });
});
