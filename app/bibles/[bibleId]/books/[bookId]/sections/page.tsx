import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { ListSection } from "@/components/sections/ListSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";

export const dynamic = "force-static";

type SectionsListPageProps = {
  params: Promise<{ bibleId: string; bookId: string }>;
};

/**
 * Sections list page. Renders the full list of sections for the given book of the Bible.
 *
 * See our [Sections Guide](https://docs.api.bible/guides/sections) for more.
 */
export default async function BookSectionsListPage(
  props: SectionsListPageProps,
) {
  const { bibleId, bookId } = await props.params;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch full list of sections for the given book from the `/bibles/{bibleId}/books/{bookId}/sections` endpoint
  const {
    data: sections,
    exchange,
    body,
  } = await traced(() => client.sections.listForBook(bibleId, bookId));

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection
        title="How to Get the Sections of a Book"
        url="https://rest.api.bible/v1/bibles/{bibleId}/books/{bookId}/sections"
        requestUrl={exchange?.request.url}
        info={
          <>
            <Lead>
              To get the list of sections of a book, send a <Code>GET</Code>{" "}
              request to this API endpoint. Put the <b>Bible ID</b> and the{" "}
              <b>Book ID</b> in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/sections">
                Sections Guide
              </Guide>
              .
            </Lead>
            <Note>
              Some Bibles do not have sections. To find if a book has sections,
              use the <Code>/books</Code> endpoint with the{" "}
              <Code>include-chapters-and-sections</Code> query parameter. For
              more information, refer to{" "}
              <Guide href="https://docs.api.bible/guides/books#fetching-a-list-of-books-for-a-bible">
                the list of books of a Bible
              </Guide>
              .
            </Note>
          </>
        }
      />

      <JSONSection json={body} exchange={exchange} />

      <ListSection
        items={sections.map((section) => ({
          title: (
            <p>
              <span className="font-bold">{section.title}</span> ({section.id})
            </p>
          ),
          href: `/bibles/${bibleId}/sections/${section.id}`,
          info: `${section.firstVerseId} - ${section.lastVerseId}`,
        }))}
      />
    </Page>
  );
}
