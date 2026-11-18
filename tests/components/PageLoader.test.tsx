import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageLoader from "@/components/PageLoader";

describe("PageLoader", () => {
  it("is a status with the name Loading", () => {
    render(<PageLoader />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
