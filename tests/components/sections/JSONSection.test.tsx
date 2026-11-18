import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Exchange } from "@/utils/api";

const reporter = vi.fn();
vi.mock("@/components/FumsPanel", () => ({
  FumsReporter: (props: { token?: string; cached?: boolean }) => {
    reporter(props);
    return null;
  },
}));

import { JSONSection } from "@/components/sections/JSONSection";

const exchange = (cachedSecondsAgo?: number): Exchange => ({
  request: {
    method: "GET",
    url: "https://rest.api.bible/v1/bibles?language=eng&ids=a",
    headers: [["api-key", "secret"]],
  },
  response: {
    status: 200,
    statusText: "OK",
    durationMs: 123,
    headers: [["content-type", "application/json"]],
    cachedSecondsAgo,
  },
});

const rawSection = (container: HTMLElement) =>
  container.querySelector("#raw-json") as HTMLDetailsElement;

describe("JSONSection", () => {
  it("shows only the raw JSON, pretty printed, when there is no exchange", () => {
    const { container } = render(<JSONSection json={{ data: { id: 1 } }} />);
    expect(screen.queryByText("Request")).toBeNull();
    expect(screen.queryByText("Response")).toBeNull();
    expect(container.querySelector("pre")?.textContent).toBe(
      JSON.stringify({ data: { id: 1 } }, null, 2),
    );
  });

  it("starts collapsed unless defaultOpen is set", () => {
    const { container, rerender } = render(<JSONSection json={{}} />);
    expect(rawSection(container).open).toBe(false);
    rerender(<JSONSection json={{}} defaultOpen />);
    expect(rawSection(container).open).toBe(true);
  });

  it("expands the raw JSON when it is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<JSONSection json={{}} />);
    await user.click(screen.getByText("Raw JSON Output"));
    expect(rawSection(container).open).toBe(true);
  });

  it("shows request details with the query parameters and headers", () => {
    const { container } = render(
      <JSONSection json={{}} exchange={exchange()} />,
    );
    expect(screen.getByText("GET /v1/bibles")).toBeInTheDocument();
    const request = screen.getByText("Request").closest("details")!;
    expect(request).toHaveTextContent(
      "GET https://rest.api.bible/v1/bibles?language=eng&ids=a",
    );
    expect(within(request).getByText("language")).toBeInTheDocument();
    expect(within(request).getByText("eng")).toBeInTheDocument();
    expect(within(request).getByText("api-key")).toBeInTheDocument();
    expect(within(request).getByText("secret")).toBeInTheDocument();
    const wrapper = container.querySelector("[data-api-request]")!;
    expect(wrapper).toHaveAttribute(
      "data-api-request",
      "https://rest.api.bible/v1/bibles?language=eng&ids=a",
    );
    expect(wrapper).toHaveAttribute("data-api-status", "200");
  });

  it("shows the request headers only in Request and the response headers only in Response", () => {
    const ex = exchange();
    ex.request.headers = [["x-sent", "sent-value"]];
    ex.response.headers = [["x-received", "received-value"]];
    render(<JSONSection json={{}} exchange={ex} />);
    const request = screen.getByText("Request").closest("details")!;
    const response = screen.getByText("Response").closest("details")!;

    expect(within(request).getByText("x-sent")).toBeInTheDocument();
    expect(within(request).getByText("sent-value")).toBeInTheDocument();
    expect(within(request).queryByText("x-received")).toBeNull();
    expect(within(request).queryByText("received-value")).toBeNull();

    expect(within(response).getByText("x-received")).toBeInTheDocument();
    expect(within(response).getByText("received-value")).toBeInTheDocument();
    expect(within(response).queryByText("x-sent")).toBeNull();
    expect(within(response).queryByText("sent-value")).toBeNull();
  });

  it("leaves out the query parameters section when the URL has none", () => {
    const ex = exchange();
    ex.request.url = "https://rest.api.bible/v1/bibles";
    render(<JSONSection json={{}} exchange={ex} />);
    expect(screen.queryByText("Query Parameters")).toBeNull();
  });

  it("shows the response status and duration for a live response", () => {
    render(<JSONSection json={{}} exchange={exchange()} />);
    expect(screen.getByText(/200 OK · 123 ms/)).toBeInTheDocument();
    const response = screen.getByText("Response").closest("details")!;
    expect(response).toHaveTextContent("200 OK in 123 ms");
    expect(within(response).queryByText("Cache")).toBeNull();
    expect(
      within(response).getByRole("link", { name: "Raw JSON Output" }),
    ).toHaveAttribute("href", "#raw-json");
  });

  it.each([
    [30, "30 s ago"],
    [600, "10 min ago"],
    [7200, "2 h ago"],
  ])("describes a cached response of %i seconds as %s", (seconds, text) => {
    render(<JSONSection json={{}} exchange={exchange(seconds)} />);
    expect(screen.getByText(`200 OK · from the cache (${text})`)).toBeInTheDocument();
    const response = screen.getByText("Response").closest("details")!;
    expect(within(response).getByText("Cache")).toBeInTheDocument();
    expect(response).toHaveTextContent(`from the API ${text}`);
  });

  it("reports the FUMS token from the response meta", () => {
    reporter.mockClear();
    render(
      <JSONSection json={{ meta: { fumsToken: "tok" } }} exchange={exchange(10)} />,
    );
    expect(reporter).toHaveBeenCalledWith({ token: "tok", cached: true });
  });

  it("passes no token and cached false when there is none", () => {
    reporter.mockClear();
    render(<JSONSection json={{ data: [] }} exchange={exchange()} />);
    expect(reporter).toHaveBeenCalledWith({ token: undefined, cached: false });
  });
});
