import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { client, traced } from "@/utils/api";

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
      <HeaderSection bible={bible} />
      <InfoSection requestUrl={exchange?.request.url} />

      <JSONSection json={body} exchange={exchange} defaultOpen />
    </Page>
  );
}
