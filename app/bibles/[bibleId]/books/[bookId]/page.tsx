import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";
import { PageSearchParams, paramFlag, readParams } from "@/utils/queryParams";

type BookPageProps = {
  params: Promise<{ bibleId: string; bookId: string }>;
  searchParams: Promise<PageSearchParams>;
};

/**
 * Single book page. Renders resulting book content as JSON.
 *
 * See our [Books Guide](https://docs.api.bible/guides/books) for more.
 */
export default async function BookPage(props: BookPageProps) {
  const { bibleId, bookId } = await props.params;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    [
      {
        name: "include-chapters",
        options: ["true", "false"],
        defaultValue: "false",
      },
    ],
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single book from the `/bibles/{bibleId}/books/{bookId}` endpoint
  const {
    data: book,
    exchange,
    body,
  } = await traced(() =>
    client.books.get(bibleId, bookId, {
      includeChapters: paramFlag(queryParams, "include-chapters"),
    }),
  );

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection requestUrl={exchange?.request.url} />

      <QueryParamsSection params={queryParams} />
      <JSONSection
        defaultOpen
        exchange={exchange}
        //Show only the number of chapters, to keep the page short
        json={
          book.chapters
            ? {
                ...body,
                data: { ...book, chapters: `Array(${book.chapters.length})` },
              }
            : body
        }
      />
    </Page>
  );
}
