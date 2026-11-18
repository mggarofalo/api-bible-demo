import { Code, Guide, Lead, Note } from "@/components/InfoText";
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
    contentParams(),
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single verse from the `/bibles/{bibleId}/verses/{verseId}` endpoint
  const {
    data: verse,
    exchange,
    body,
  } = await traced(() =>
    client.verses.get(bibleId, verseId, contentOptions(queryParams)),
  );

  return (
    <Page>
      <HeaderSection bible={bible} />

      <InfoSection
        title="How to Get One Verse"
        url="https://rest.api.bible/v1/bibles/{bibleId}/verses/{verseId}"
        info={
          <>
            <Lead>
              To get one verse and its text, send a <Code>GET</Code> request to
              this API endpoint. Put the <b>Bible ID</b> and the{" "}
              <b>Verse ID</b> in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/verses">
                Verses Guide
              </Guide>
              .
            </Lead>
            <Note>
              The response contains the text of the verse in the{" "}
              <Code>content</Code> field. The query parameters control the
              format of this text. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/verses#verse-content">
                Verse Content Guide
              </Guide>
              .
            </Note>
          </>
        }
      />

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
