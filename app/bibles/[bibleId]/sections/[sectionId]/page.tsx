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

type SectionPageProps = {
  params: Promise<{ bibleId: string; sectionId: string }>;
  searchParams: Promise<PageSearchParams>;
};

/**
 * Single section page. Renders resulting section verse content.
 *
 * See our [Sections Guide](https://docs.api.bible/guides/sections) for more.
 */
export default async function SectionPage(props: SectionPageProps) {
  const { bibleId, sectionId } = await props.params;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    contentParams(),
    await props.searchParams,
  );

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch a single section from the `/bibles/{bibleId}/sections/{sectionId}` endpoint
  const {
    data: section,
    exchange,
    body,
  } = await traced(() =>
    client.sections.get(bibleId, sectionId, contentOptions(queryParams)),
  );

  return (
    <Page>
      <HeaderSection bible={bible} />

      <InfoSection
        title="How to Get One Section"
        url="https://rest.api.bible/v1/bibles/{bibleId}/sections/{sectionId}"
        info={
          <>
            <Lead>
              To get one section and its text, send a <Code>GET</Code> request
              to this API endpoint. Put the <b>Bible ID</b> and the{" "}
              <b>Section ID</b> in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/sections">
                Sections Guide
              </Guide>
              .
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
        linkBase={`/bibles/${bibleId}/sections`}
        query={toQueryString(queryParams)}
        verseContent={section}
        title={section.id}
      />
    </Page>
  );
}
