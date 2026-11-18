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

      <InfoSection requestUrl={exchange?.request.url} />

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
