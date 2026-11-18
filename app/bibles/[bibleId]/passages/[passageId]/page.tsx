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
    contentParams(),
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single passage from the `/bibles/{bibleId}/passages/{passageId}` endpoint
  const {
    data: passage,
    exchange,
    body,
  } = await traced(() =>
    client.passages.get(bibleId, passageId, contentOptions(queryParams)),
  );

  if (!passage) {
    notFound();
  }

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection
        title="How to Get a Passage"
        url="https://rest.api.bible/v1/bibles/{bibleId}/passages/{passageId}"
        info={
          <>
            <Lead>
              To get a passage of a Bible, send a <Code>GET</Code> request to
              this API endpoint. Put the <b>Bible ID</b> and the{" "}
              <b>Passage ID</b> in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/passages">
                Passages Guide
              </Guide>
              .
            </Lead>
            <Lead>
              A <b>Passage ID</b> can include more than one chapter or book.
              But the API gives only <i>the first 200 verses of the passage</i>
              . In that condition, the <Code>id</Code> field of the response
              shows the range of verses that the API gave. To get a large
              passage, divide it into smaller passages.
            </Lead>
            <Note>
              The response also contains the text of the verses, in the{" "}
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
        title={passage.id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        verseContent={passage as any}
      />
    </Page>
  );
}
