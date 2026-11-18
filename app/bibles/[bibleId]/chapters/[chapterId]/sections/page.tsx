import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { ListSection } from "@/components/sections/ListSection";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";

export const dynamic = "force-static";

type SectionsListPageProps = {
  params: Promise<{ bibleId: string; chapterId: string }>;
};

/**
 * Sections list page. Renders the full list of sections for the given chapter of the Bible.
 *
 * See our [Sections Guide](https://docs.api.bible/guides/sections) for more.
 */
export default async function SectionsListPage(props: SectionsListPageProps) {
  const { bibleId, chapterId } = await props.params;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Fetch full list of sections (if they exist) for the given chapter from the `/bibles/{bibleId}/chapters/{chapterId}/sections` endpoint
  const {
    data: sections,
    exchange,
    body,
  } = await traced(() =>
    client.sections.listForChapter(bibleId, chapterId),
  ).catch(() => ({ data: [], exchange: undefined, body: { data: [] } }));

  return (
    <Page>
      <HeaderSection bible={bible} />

      <InfoSection requestUrl={exchange?.request.url} />

      <JSONSection json={body} exchange={exchange} />

      <ListSection
        title="Sections"
        items={sections.map((section) => ({
          title: (
            <p>
              <span className="font-bold">{section.title}</span> ({section.id})
            </p>
          ),
          href: `/bibles/${bibleId}/sections/${section.id}`,
          info: `${section.firstVerseId} - ${section.lastVerseId}`,
        }))}
      />
    </Page>
  );
}
