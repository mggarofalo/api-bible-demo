import { Chapter, Section, Verse } from "@americanbible/api-bible-sdk";
import { LinkButton } from "../LinkButton";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

type VerseContentProps = {
  linkBase?: string;
  /** Query string for the "Previous" and "Next" links, so they keep the query parameters of the page */
  query?: string;
  verseContent: Verse | Chapter | Section;
  title?: string;
};

/**
 * Renders verse content returned from the API. Leverages the [scripture-styles](https://npmjs.org/package/scripture-styles) `npm`
 * package for styling.
 *
 * The `content-type` query parameter of the request controls the format of the content:
 *   - `html`: shown as formatted text
 *   - `text`: shown as plain text
 *   - `json`: shown as the JSON structure that the API gave
 */
export const VerseContentSection = ({
  linkBase,
  query = "",
  title = "Verses",
  verseContent: { previous, next, content, verseCount },
}: VerseContentProps) => {
  //HTML content starts with a tag. Plain text does not.
  const isHtml = typeof content === "string" && /^\s*</.test(content);

  return (
    <>
      <div className="w-full h-12" />
      <div className="flex items-end border-black border-b-[1px] px-0 sm:px-8 sticky top-[-1px] bg-white">
        <h3 className="text-xl font-bold px-4 py-2 border-black border-x-[1px] border-t-[1px]">
          {title}
        </h3>
        <h5 className="text-lg px-4 py-2 border-black border-r-[1px] border-t-[1px]">
          {verseCount} {verseCount === 1 ? "Verse" : "Verses"}
        </h5>
        {!!linkBase && (
          <>
            <div className="grow" />
            {!!previous?.id && (
              <>
                <LinkButton
                  className="sm:hidden border-x-[1px] border-t-[1px] h-full"
                  href={`${linkBase}/${previous.id}${query}`}
                  title=""
                >
                  <ArrowLeftCircle size={16} />
                </LinkButton>
                <LinkButton
                  className="hidden sm:flex border-x-[1px] border-t-[1px] h-full"
                  href={`${linkBase}/${previous.id}${query}`}
                  title="Previous"
                />
              </>
            )}
            {!!next?.id && (
              <>
                <LinkButton
                  className={`sm:hidden border-r-[1px] border-t-[1px] h-full ${!previous?.id ? "border-l-[1px]" : ""}`}
                  href={`${linkBase}/${next.id}${query}`}
                  title=""
                >
                  <ArrowRightCircle size={16} />
                </LinkButton>
                <LinkButton
                  className={`hidden sm:flex border-r-[1px] border-t-[1px] h-full ${!previous?.id ? "border-l-[1px]" : ""}`}
                  href={`${linkBase}/${next.id}${query}`}
                  title="Next"
                />
              </>
            )}
          </>
        )}
      </div>
      <div className="w-full flex flex-col items-center border-b-[1px]">
        <div className="w-full">
          {isHtml ? (
            <div
              className="scripture-styles p-4"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <pre className="p-4 whitespace-pre-wrap break-words">
              {typeof content === "string"
                ? content
                : JSON.stringify(content, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </>
  );
};
