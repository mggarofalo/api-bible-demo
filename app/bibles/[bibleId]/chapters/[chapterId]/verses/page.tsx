import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { ListSection } from "@/components/sections/ListSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";

export const dynamic = "force-static";

type VersesListPageProps = {
  params: Promise<{ bibleId: string; chapterId: string }>;
};

/**
 * Verses list page. Renders the full list of verses for the given chapter of the Bible.
 *
 * See our [Verses Guide](https://docs.api.bible/guides/verses) for more.
 */
export default async function VersesListPage(props: VersesListPageProps) {
  const { bibleId, chapterId } = await props.params;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch full list of verses for the given chapter from the `/bibles/{bibleId}/chapters/{chapterId}/verses` endpoint
  const {
    data: verses,
    exchange,
    body,
  } = await traced(() => client.verses.list(bibleId, chapterId));

  return (
    <Page>
      <HeaderSection bible={bible} />
      <InfoSection
        title="How to Get the Verses of a Chapter"
        url="https://rest.api.bible/v1/bibles/{bibleId}/chapters/{chapterId}/verses"
        info={
          <>
            <Lead>
              To get the list of verses of a chapter, send a <Code>GET</Code>{" "}
              request to this API endpoint. Put the <b>Bible ID</b> and the{" "}
              <b>Chapter ID</b> in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/verses">
                Verses Guide
              </Guide>
              .
            </Lead>
            <Note>
              The <Code>/chapters</Code> endpoint can also give verse data. For
              more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/chapters#fetching-a-list-of-chapters-for-a-book">
                Chapters Guide
              </Guide>
              .
            </Note>
          </>
        }
      />

      <JSONSection json={body} exchange={exchange} />

      <ListSection
        title="Verses"
        items={verses.map((verse) => ({
          title: <p className="font-bold">{verse.reference}</p>,
          info: verse.id,
          href: `/bibles/${bibleId}/verses/${verse.id}`,
        }))}
      />
    </Page>
  );
}
