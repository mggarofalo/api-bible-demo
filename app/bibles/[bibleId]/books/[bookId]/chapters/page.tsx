import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { ListSection } from "@/components/sections/ListSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";

export const dynamic = "force-static";

type ChaptersListPageProps = {
  params: Promise<{ bibleId: string; bookId: string }>;
};

/**
 * Chapters list page. Renders the full list of chapters for the given book of the Bible.
 *
 * See our [Chapters Guide](https://docs.api.bible/guides/chapters) for more.
 */
export default async function ChaptersListPage(props: ChaptersListPageProps) {
  const { bibleId, bookId } = await props.params;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single book from the `/bibles/{bibleId}/books/{bookId}` endpoint
  const { data: book } = await client.books.get(bibleId, bookId);
  //Fetch full list of chapters for the given book from the `/bibles/{bibleId}/books/{bookId}/chapters` endpoint
  const {
    data: chapters,
    exchange,
    body,
  } = await traced(() => client.chapters.list(bibleId, bookId));

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection
        title="How to Get the Chapters of a Book"
        url="https://rest.api.bible/v1/bibles/{bibleId}/books/{bookId}/chapters"
        info={
          <>
            <Lead>
              To get the list of chapters of a book, send a <Code>GET</Code>{" "}
              request to this API endpoint. Put the <b>Bible ID</b> and the{" "}
              <b>Book ID</b> in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/chapters">
                Chapters Guide
              </Guide>
              .
            </Lead>
            <Note>
              The <Code>/books</Code> endpoint can also give chapter data. Use
              the <Code>include-chapters</Code> query parameter. For more
              information, refer to{" "}
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
        title="Chapters"
        items={chapters.map((chapter) => ({
          title: (
            <p className="font-bold">
              {book.name} {chapter.number}
            </p>
          ),
          info: chapter.id,
          href: `/bibles/${bibleId}/chapters/${chapter.id}`,
        }))}
      />
    </Page>
  );
}
