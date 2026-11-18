import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { client, traced } from "@/utils/api";
import { Book, Search } from "lucide-react";

export const dynamic = "force-static";

type BiblePageProps = {
  params: Promise<{ bibleId: string }>;
};

/**
 * Single Bible page. Renders resulting Bible content as JSON.
 *
 * See our [Bibles Guide](https://docs.api.bible/guides/bibles) for more.
 */
export default async function BiblePage(props: BiblePageProps) {
  const { bibleId } = await props.params;

  //Fetch a single bible from the `/bibles/{bibleId}` endpoint
  const {
    data: bible,
    exchange,
    body,
  } = await traced(() => client.bibles.get(bibleId));

  return (
    <Page>
      <HeaderSection
        bible={bible}
        actionItems={[
          {
            title: "Show the Books",
            href: `/bibles/${bible.id}/books`,
            children: <Book size={16} />,
          },
          {
            title: "Search",
            href: `/bibles/${bible.id}/search`,
            children: <Search size={16} />,
          },
        ]}
      />
      <InfoSection
        title="How to Get the Data of One Bible"
        url="https://rest.api.bible/v1/bibles/{bibleId}"
        info={
          <>
            <Lead>
              To get the data of one Bible, send a <Code>GET</Code> request to
              this API endpoint. Put the <b>Bible ID</b> of the applicable Bible
              in the URL. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/bibles">
                Bibles Guide
              </Guide>
              .
            </Lead>
            <Note>
              If you do not know the <b>Bible ID</b>, first{" "}
              <Guide href="https://docs.api.bible/guides/bibles#fetching-your-available-bibles">
                get the list of your Bibles
              </Guide>
              .
            </Note>
          </>
        }
      />

      <JSONSection json={body} exchange={exchange} defaultOpen />
    </Page>
  );
}
