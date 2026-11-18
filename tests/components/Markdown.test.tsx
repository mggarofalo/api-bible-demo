import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/Markdown";

describe("Markdown", () => {
  it("renders paragraphs split by blank lines", () => {
    render(<Markdown text={"First one\n\nSecond one"} />);
    expect(screen.getAllByText(/one/)).toHaveLength(2);
    expect(screen.getByText("First one").tagName).toBe("P");
  });

  it("splits paragraphs at a blank line that has spaces in it", () => {
    //The blank line has a space, a tab and a space
    render(<Markdown text={"First one\n \t \nSecond one"} />);
    expect(screen.getByText("First one").tagName).toBe("P");
    expect(screen.getByText("Second one").tagName).toBe("P");
  });

  it("joins the lines of one paragraph with spaces and handles CRLF", () => {
    render(<Markdown text={"line a\r\nline b"} />);
    expect(screen.getByText("line a line b")).toBeInTheDocument();
  });

  it("renders inline code, bold, emphasis and links", () => {
    const { container } = render(
      <Markdown text="Use `code` and **bold** and *star* and _under_ and [site](https://x.test/a)." />,
    );
    expect(container.querySelector("code")).toHaveTextContent("code");
    expect(container.querySelector("b")).toHaveTextContent("bold");
    const italics = [...container.querySelectorAll("i")].map(
      (i) => i.textContent,
    );
    expect(italics).toEqual(["star", "under"]);
    expect(screen.getByRole("link", { name: "site" })).toHaveAttribute(
      "href",
      "https://x.test/a",
    );
  });

  it("keeps an escaped asterisk as plain text", () => {
    const { container } = render(<Markdown text={"a \\*not italic\\* b"} />);
    expect(container.querySelector("i")).toBeNull();
    expect(container).toHaveTextContent("a *not italic* b");
  });

  it("keeps an escaped asterisk as plain text inside link text", () => {
    render(<Markdown text={"[a \\*b\\* c](https://x.test/a)"} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://x.test/a");
    expect(link).toHaveTextContent("a *b* c");
    expect(link.querySelector("i")).toBeNull();
  });

  it("does not turn underscores inside words into emphasis", () => {
    const { container } = render(<Markdown text="the bible_id_value field" />);
    expect(container.querySelector("i")).toBeNull();
    expect(container).toHaveTextContent("the bible_id_value field");
  });

  it("renders a table with head and body cells", () => {
    render(
      <Markdown
        text={"| Name | Value |\n| --- | --- |\n| `a` | one |\n| b | **two** |"}
      />,
    );
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["Name", "Value"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("two").tagName).toBe("B");
    expect(within(table).getByText("a").tagName).toBe("CODE");
  });

  it("treats a two-line pipe block as a paragraph, not a table", () => {
    render(<Markdown text={"| a | b |\n| c | d |"} />);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps a block as a paragraph when only one of its three lines starts with a pipe", () => {
    render(<Markdown text={"First line\n| a | b |\nlast line"} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("First line | a | b | last line").tagName).toBe("P");
  });

  it("renders a table whose lines have spaces before the pipe", () => {
    render(<Markdown text={"  | Name | Value |\n  | --- | --- |\n  | a | one |"} />);
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["Name", "Value"]);
    expect(within(table).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "a",
      "one",
    ]);
  });

  it("does not inject raw HTML or scripts", () => {
    const { container } = render(
      <Markdown
        text={'Hi <script>window.__x=1</script> <img src=x onerror="y()">'}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("<script>window.__x=1</script>");
  });

  it.each([
    "https://x.test/a",
    "http://x.test/a",
    "mailto:help@x.test",
    "MAILTO:help@x.test",
    "/bibles",
    "#section",
    "?page=2",
    "docs/page",
  ])("keeps a link to %s", (href) => {
    render(<Markdown text={`See [here](${href}).`} />);
    expect(screen.getByRole("link", { name: "here" })).toHaveAttribute("href", href);
  });

  it.each([
    "javascript:alert%281%29",
    "JaVaScRiPt:alert%281%29",
    "\u0001javascript:alert%281%29",
    "\u001fjavascript:alert%281%29",
    "data:text/html,hi",
    "vbscript:msgbox%281%29",
    "ftp://x.test/a",
    "https://x.test:bad/a",
  ])("shows only the text of a link to %j", (href) => {
    const { container } = render(<Markdown text={`See [here](${href}).`} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent("See here.");
  });

  it("does not make a link when the URL has a space or a tab in it", () => {
    const { container } = render(
      <Markdown text={"[a](java\tscript:x) [b]( javascript:x)"} />,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders inline mode as running text without paragraphs", () => {
    const { container } = render(
      <p>
        <Markdown inline text={"  some   `code`\n and **bold**  "} />
      </p>,
    );
    expect(container.querySelector("div")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("code")).toHaveTextContent("code");
    expect(container.querySelector("p")).toHaveTextContent(
      "some code and bold",
    );
  });

  it("renders nothing for empty text", () => {
    const { container } = render(<Markdown text={"  \n\n "} />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});
