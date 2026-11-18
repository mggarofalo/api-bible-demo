import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { ListSection } from "@/components/sections/ListSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";
import { PageSearchParams, paramFlag, readParams } from "@/utils/queryParams";

type BooksListPageProps = {
  params: Promise<{ bibleId: string }>;
  searchParams: Promise<PageSearchParams>;
};

/**
 * Books list page. Renders the full list of books for a given Bible.
 *
 * See our [Books Guide](https://docs.api.bible/guides/books) for more.
 */
export default async function BooksListPage(props: BooksListPageProps) {
  const { bibleId } = await props.params;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    [
      {
        name: "include-chapters",
        options: ["true", "false"],
        defaultValue: "false",
      },
      {
        name: "include-chapters-and-sections",
        options: ["true", "false"],
        defaultValue: "false",
      },
    ],
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch full list of books for the given Bible from the `/bibles/{bibleId}/books` endpoint
  const {
    data: books,
    exchange,
    body,
  } = await traced(() =>
    client.books.list(bibleId, {
      includeChapters: paramFlag(queryParams, "include-chapters"),
      includeChaptersAndSections: paramFlag(
        queryParams,
        "include-chapters-and-sections",
      ),
    }),
  );

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection
        title="How to Get the Books of a Bible"
        url="https://rest.api.bible/v1/bibles/{bibleId}/books"
        requestUrl={exchange?.request.url}
        info={
          <>
            <Lead>
              To get the list of books of a Bible, send a <Code>GET</Code>{" "}
              request to this API endpoint. Put the <b>Bible ID</b> of the
              applicable Bible in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/books">
                Books Guide
              </Guide>
              .
            </Lead>
            <Note>
              Use the <Code>include-chapters</Code> query parameter to get all
              the books and chapters of the Bible in one request.
            </Note>
          </>
        }
      />

      <QueryParamsSection params={queryParams} />
      <JSONSection json={body} exchange={exchange} />

      <ListSection
        title="Books"
        items={books.map((book) => ({
          title: (
            <p>
              <span className="font-bold">{book.name}</span> ({book.id})
            </p>
          ),
          href: `/bibles/${bibleId}/books/${book.id}`,
          //The chapters are in the response only if a query parameter asks for them
          info: book.chapters ? `${book.chapters.length} chapters` : undefined,
        }))}
      />
    </Page>
  );
}
