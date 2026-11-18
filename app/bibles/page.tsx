import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { FilterableListSection } from "@/components/sections/FilterableListSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { client, traced } from "@/utils/api";
import {
  flagParam,
  PageSearchParams,
  paramFlag,
  paramList,
  paramText,
  readParams,
  textParam,
} from "@/utils/queryParams";

type BiblesPageProps = {
  searchParams: Promise<PageSearchParams>;
};

/**
 * Bibles page of the application. Shows the list of Bibles that this application can access.
 *
 * See our [Bibles Guide](https://docs.api.bible/guides/bibles) for more.
 */
export default async function BiblesPage(props: BiblesPageProps) {
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    [
      textParam("language", "eng"),
      textParam("abbreviation", "engKJV"),
      textParam("name", "King James"),
      textParam("ids", "de4e12af7f28f599-01"),
      flagParam("include-full-details", "false"),
    ],
    await props.searchParams,
  );

  //Fetch bibles from the `/bibles` endpoint
  const {
    data: bibles,
    exchange,
    body,
  } = await traced(() =>
    client.bibles.list({
      language: paramText(queryParams, "language"),
      abbreviation: paramText(queryParams, "abbreviation"),
      name: paramText(queryParams, "name"),
      ids: paramList(queryParams, "ids"),
      includeFullDetails: paramFlag(queryParams, "include-full-details"),
    }),
  );

  return (
    <Page>
      <HeaderSection
        title="Available Bibles"
        breadcrumbs={[
          {
            title: "Home",
            href: "/",
          },
          {
            title: "Bibles",
            href: "/bibles",
          },
        ]}
      />
      <InfoSection
        title="How to Get Your Bibles"
        url="https://rest.api.bible/v1/bibles"
        info={
          <>
            <Lead>
              To get the list of your Bibles, send a <Code>GET</Code> request to
              this API endpoint. The response contains all the Bibles that your
              API key can access. This includes Public Domain and Creative
              Commons versions, and Bibles with a license from a{" "}
              <b>Pro Plan</b>. For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/bibles">
                Bibles Guide
              </Guide>
              .
            </Lead>
            <Note>
              Your plan controls the Bibles that you can access. The{" "}
              <b>Starter Plan</b> gives access to Public Domain and Creative
              Commons versions. The <b>Pro Plan</b> can include more
              translations that have a license. For more information, refer to
              the{" "}
              <Guide href="https://api.bible/bibles">
                Bible Versions Table
              </Guide>
              .
            </Note>
          </>
        }
      />

      <QueryParamsSection params={queryParams} />
      <JSONSection json={body} exchange={exchange} />

      <FilterableListSection
        title="Bibles"
        filterLabel="Filter by name, abbreviation, language or ID"
        items={bibles.map((bible) => ({
          title: (
            <p>
              <span className="font-bold">{bible.name}</span> (
              {bible.abbreviation})
            </p>
          ),
          href: `/bibles/${bible.id}`,
          info: bible.id,
          filterText: `${bible.name} ${bible.nameLocal ?? ""} ${bible.abbreviation ?? ""} ${bible.language?.name ?? ""} ${bible.id}`,
        }))}
      />
    </Page>
  );
}
