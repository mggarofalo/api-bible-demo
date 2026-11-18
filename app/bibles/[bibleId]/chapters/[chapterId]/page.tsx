import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { VerseContentSection } from "@/components/sections/VerseContentSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";
import {
  contentOptions,
  contentParams,
  PageSearchParams,
  readParams,
  toQueryString,
} from "@/utils/queryParams";

type ChapterPageProps = {
  params: Promise<{ bibleId: string; chapterId: string }>;
  searchParams: Promise<PageSearchParams>;
};

/**
 * Single chapter page. Renders resulting chapter verse content.
 *
 * See our [Chapters Guide](https://docs.api.bible/guides/chapters) for more.
 */
export default async function ChapterPage(props: ChapterPageProps) {
  const { bibleId, chapterId } = await props.params;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    contentParams(),
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single chapter from the `/bibles/{bibleId}/chapters/{chapterId}` endpoint
  const {
    data: chapter,
    exchange,
    body,
  } = await traced(() =>
    client.chapters.get(bibleId, chapterId, contentOptions(queryParams)),
  );

  return (
    <Page>
      <HeaderSection bible={bible} />

      <InfoSection requestUrl={exchange?.request.url} />

      <QueryParamsSection params={queryParams} />
      <JSONSection json={body} exchange={exchange} />

      <VerseContentSection
        linkBase={`/bibles/${bibleId}/chapters`}
        query={toQueryString(queryParams)}
        verseContent={chapter}
        title={chapter.id}
      />
    </Page>
  );
}
