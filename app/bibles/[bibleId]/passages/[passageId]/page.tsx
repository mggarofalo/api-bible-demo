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
} from "@/utils/queryParams";
import { notFound } from "next/navigation";

type PassagePageProps = {
  params: Promise<{ bibleId: string; passageId: string }>;
  searchParams: Promise<PageSearchParams>;
};

/**
 * Single passage page. Renders resulting passage verse content.
 *
 * See our [Passages Guide](https://docs.api.bible/guides/passages) for more.
 */
export default async function PassagePage(props: PassagePageProps) {
  const { bibleId, passageId } = await props.params;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    contentParams({}, [USE_ORG_ID]),
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single passage from the `/bibles/{bibleId}/passages/{passageId}` endpoint
  const {
    data: passage,
    exchange,
    body,
  } = await traced(
    () => client.passages.get(bibleId, passageId, contentOptions(queryParams)),
    //The SDK does not have `use-org-id`, so `traced` adds it to the request
    orgIdQuery(queryParams),
  );

  if (!passage) {
    notFound();
  }

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection requestUrl={exchange?.request.url} />

      <QueryParamsSection params={queryParams} />
      <JSONSection json={body} exchange={exchange} />

      <VerseContentSection
        title={passage.id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        verseContent={passage as any}
      />
    </Page>
  );
}
