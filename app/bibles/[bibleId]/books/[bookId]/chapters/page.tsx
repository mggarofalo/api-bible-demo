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
      <InfoSection requestUrl={exchange?.request.url} />

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
