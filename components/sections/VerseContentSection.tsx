import { getBibles } from "@/utils/getDemoBible";
import { Chapter, Section, Verse } from "@americanbible/api-bible-sdk";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { LinkButton } from "../LinkButton";

type Content = Verse["content"];

type VerseContentProps = {
  linkBase?: string;
  /** Query string for the "Previous" and "Next" links, so they keep the query parameters of the page */
  query?: string;
  verseContent: Verse | Chapter | Section;
  title?: string;
};

/**
 * Shows one block of content in the format that the API gave:
 *   - `html`: shown as formatted text
 *   - `text`: shown as plain text
 *   - `json`: shown as the JSON structure
 */
const ContentBlock = ({ content }: { content: Content }) => {
  //HTML content starts with a tag. Plain text does not.
  if (typeof content === "string" && /^\s*</.test(content)) {
    return (
      <div
        className="scripture-styles p-4"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <pre className="p-4 whitespace-pre-wrap break-words">
      {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
    </pre>
  );
};

/**
 * Renders verse content returned from the API. Leverages the [scripture-styles](https://npmjs.org/package/scripture-styles) `npm`
 * package for styling. The `content-type` query parameter of the request controls the
 * format of the content.
 *
 * When the request has the `parallels` query parameter, the response also has the same
 * content from other Bibles, in `parallels`. Each of those shows below the content of
 * the current Bible, with the name of its Bible.
 */
export const VerseContentSection = async ({
  linkBase,
  query = "",
  title = "Verses",
  verseContent,
}: VerseContentProps) => {
  const { previous, next, content, verseCount } = verseContent;
  //The SDK does not give a type to `parallels`, because the API adds it only on request
  const parallels =
    (verseContent as { parallels?: { bibleId: string; content?: Content }[] })
      .parallels ?? [];
  //The names of the Bibles, to give a title to each block. The list of Bibles is in memory.
  const bibles = parallels.length ? await getBibles() : [];
  const bibleName = (bibleId: string) => {
    const bible = bibles.find(({ id }) => id === bibleId);
    return bible ? `${bible.name} (${bible.abbreviation})` : bibleId;
  };

  return (
    <>
      <div className="w-full h-12" />
      <div className="flex items-end gap-3 border-line border-b-[1px] px-3 sm:px-8 sticky top-[-1px] bg-white">
        <h3 className="folder-tab text-xl font-bold px-4 py-2">{title}</h3>
        <h5 className="folder-tab text-lg px-4 py-2">
          {verseCount} {verseCount === 1 ? "Verse" : "Verses"}
        </h5>
        {!!linkBase && (
          <>
            <div className="grow" />
            {!!previous?.id && (
              <>
                <LinkButton
                  tab
                  className="sm:hidden"
                  href={`${linkBase}/${previous.id}${query}`}
                  title=""
                >
                  <ArrowLeftCircle size={16} aria-hidden="true" />
                  {/* The name of the link for a screen reader, the same as the text link */}
                  <span className="sr-only">Previous</span>
                </LinkButton>
                <LinkButton
                  tab
                  className="hidden sm:flex"
                  href={`${linkBase}/${previous.id}${query}`}
                  title="Previous"
                />
              </>
            )}
            {!!next?.id && (
              <>
                <LinkButton
                  tab
                  className="sm:hidden"
                  href={`${linkBase}/${next.id}${query}`}
                  title=""
                >
                  <ArrowRightCircle size={16} aria-hidden="true" />
                  {/* The name of the link for a screen reader, the same as the text link */}
                  <span className="sr-only">Next</span>
                </LinkButton>
                <LinkButton
                  tab
                  className="hidden sm:flex"
                  href={`${linkBase}/${next.id}${query}`}
                  title="Next"
                />
              </>
            )}
          </>
        )}
      </div>
      <div className="w-full border-b-[1px]">
        {!!parallels.length && (
          <h4 className="px-4 pt-4 text-sm font-bold">
            {bibleName(verseContent.bibleId)}
          </h4>
        )}
        <ContentBlock content={content} />
        {parallels.map((parallel) => (
          <div key={parallel.bibleId} className="border-line border-t-[1px]">
            <h4 className="px-4 pt-4 text-sm font-bold">
              {bibleName(parallel.bibleId)}
            </h4>
            <ContentBlock content={parallel.content} />
          </div>
        ))}
      </div>
    </>
  );
};
