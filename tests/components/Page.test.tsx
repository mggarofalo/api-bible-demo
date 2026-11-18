import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page } from "@/components/Page";

describe("Page", () => {
  it("renders its children", () => {
    render(
      <Page>
        <p>content</p>
      </Page>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
