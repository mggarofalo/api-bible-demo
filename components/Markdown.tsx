import { Fragment, ReactNode } from "react";

type MarkdownProps = {
  /** Markdown text from the API reference */
  text: string;
  /** Shows the text as one line of running text, without paragraphs or tables */
  inline?: boolean;
};

//Marks an asterisk that the text escapes (`\*`), so it is not read as emphasis
const ESCAPED_ASTERISK = "\u0000";

//The kinds of URL that a link can have. A URL with no scheme is relative to the page.
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const RELATIVE_BASE = "https://base.invalid";

/**
 * Tells if a link can go to this URL. Other schemes, such as `javascript:` or `data:`,
 * can run code, so the text of such a link shows with no link. The URL parser
 * removes spaces and control characters and ignores case, as the browser does.
 */
const isSafeHref = (href: string) => {
  try {
    return SAFE_PROTOCOLS.has(new URL(href, RELATIVE_BASE).protocol);
  } catch {
    return false;
  }
};

/** Renders the Markdown in one line of text: code, bold, emphasis and links */
const renderInline = (text: string): ReactNode[] =>
  text
    .replaceAll("\\*", ESCAPED_ASTERISK)
    .split(
      /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\b_[^_]+_\b|\*[^*]+\*)/g,
    )
    .map((part, index) => {
      const plain = (value: string) => value.replaceAll(ESCAPED_ASTERISK, "*");
      if (part.startsWith("`")) {
        return (
          <code key={index} className="font-bold">
            {plain(part.slice(1, -1))}
          </code>
        );
      }
      if (part.startsWith("**")) {
        return <b key={index}>{plain(part.slice(2, -2))}</b>;
      }
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link && !isSafeHref(link[2])) {
        return <Fragment key={index}>{plain(link[1])}</Fragment>;
      }
      if (link) {
        return (
          <a key={index} href={link[2]} className="underline">
            {plain(link[1])}
          </a>
        );
      }
      if (/^(_[^_]+_|\*[^*]+\*)$/.test(part)) {
        return <i key={index}>{plain(part.slice(1, -1))}</i>;
      }
      return <Fragment key={index}>{plain(part)}</Fragment>;
    });

const tableCells = (line: string) =>
  line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());

/**
 * Shows Markdown text from the API reference: paragraphs, tables, code, bold, emphasis
 * and links. This is the subset of Markdown that the reference uses. The text is
 * shown as the reference gives it, with no changes to its words.
 */
export const Markdown = ({ text, inline }: MarkdownProps) => {
  if (inline) {
    return <>{renderInline(text.replace(/\s+/g, " ").trim())}</>;
  }

  const blocks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim());

        //A table: each line starts with `|`, and the second line divides the head from the body
        if (lines.length > 2 && lines.every((line) => line.startsWith("|"))) {
          const [head, , ...rows] = lines;
          return (
            <div key={index} className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    {tableCells(head).map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="px-2 py-1 text-left border-line border-b-[1px]"
                      >
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {tableCells(row).map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-2 py-1 border-line border-b-[1px]"
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <p key={index}>{renderInline(lines.join(" "))}</p>;
      })}
    </div>
  );
};
