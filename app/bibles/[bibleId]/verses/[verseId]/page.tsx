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
  orgIdQuery,
  readParams,
  USE_ORG_ID,
  toQueryString,
} from "@/utils/queryParams";

type VersePageProps = {
  params: Promise<{ bibleId: string; verseId: string }>;
  searchParams: Promise<PageSearchParams>;
};

/**
 * Single verse page. Renders resulting verse content.
 *
 * See our [Verses Guide](https://docs.api.bible/guides/verses) for more.
 */
export default async function VersePage(props: VersePageProps) {
  const { bibleId, verseId } = await props.params;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    contentParams({}, [USE_ORG_ID]),
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single verse from the `/bibles/{bibleId}/verses/{verseId}` endpoint
  const {
    data: verse,
    exchange,
    body,
  } = await traced(
    () => client.verses.get(bibleId, verseId, contentOptions(queryParams)),
    //The SDK does not have `use-org-id`, so `traced` adds it to the request
    orgIdQuery(queryParams),
  );

  return (
    <Page>
      <HeaderSection bible={bible} />

      <InfoSection requestUrl={exchange?.request.url} />

      <QueryParamsSection params={queryParams} />
      <JSONSection json={body} exchange={exchange} />

      <VerseContentSection
        linkBase={`/bibles/${bibleId}/verses`}
        query={toQueryString(queryParams)}
        verseContent={verse}
        title={verse.id}
      />
    </Page>
  );
}
