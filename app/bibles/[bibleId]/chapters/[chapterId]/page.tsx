import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { VerseContentSection } from "@/components/sections/VerseContentSection";
import { client, traced } from "@/utils/api";
import { hasSections } from "@/utils/demoBibles";
import { getDemoBible } from "@/utils/getDemoBible";
import {
  contentOptions,
  contentParams,
  PageSearchParams,
  readParams,
  toQueryString,
} from "@/utils/queryParams";
import { BookText, TextInitial } from "lucide-react";

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
      <HeaderSection
        bible={bible}
        actionItems={[
          {
            title: "Show the Verses",
            href: `/bibles/${bibleId}/chapters/${chapterId}/verses`,
            children: <TextInitial size={16} />,
          },
          //Only link to sections for Bibles that include them
          ...(hasSections(bibleId)
            ? [
                {
                  title: "Show the Sections",
                  href: `/bibles/${bibleId}/chapters/${chapterId}/sections`,
                  children: <BookText size={16} />,
                },
              ]
            : []),
        ]}
      />

      <InfoSection
        title="How to Get One Chapter"
        url="https://rest.api.bible/v1/bibles/{bibleId}/chapters/{chapterId}"
        requestUrl={exchange?.request.url}
        info={
          <>
            <Lead>
              To get one chapter, send a <Code>GET</Code> request to this API
              endpoint. Put the <b>Bible ID</b> and the <b>Chapter ID</b> in the
              URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/chapters">
                Chapters Guide
              </Guide>
              .
            </Lead>
            <Note>
              The response also contains the text of all the verses in the
              chapter, in the <Code>content</Code> field. The query parameters
              control the format of this text. For more information, refer to
              the{" "}
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
        linkBase={`/bibles/${bibleId}/chapters`}
        query={toQueryString(queryParams)}
        verseContent={chapter}
        title={chapter.id}
      />
    </Page>
  );
}
