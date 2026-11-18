import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { FilterableListSection } from "@/components/sections/FilterableListSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { BibleScopeSwitch } from "@/components/BibleScope";
import { client, traced } from "@/utils/api";
import {
  BIBLE_SCOPE_COOKIE,
  parseBibleScope,
  SELECTED_BIBLE_IDS,
} from "@/utils/bibleScope";
import {
  flagParam,
  PageSearchParams,
  paramFlag,
  paramList,
  paramText,
  readParams,
  textParam,
} from "@/utils/queryParams";
import { cookies } from "next/headers";

type BiblesPageProps = {
  searchParams: Promise<PageSearchParams>;
};

/**
 * Bibles page of the application. Shows the list of Bibles that this application can access.
 *
 * The Bible scope (see utils/bibleScope.ts) gives the default of the `ids` query parameter:
 * the short list of Bibles, or no value (all Bibles). A value in the URL has priority.
 *
 * See our [Bibles Guide](https://docs.api.bible/guides/bibles) for more.
 */
export default async function BiblesPage(props: BiblesPageProps) {
  const scope = parseBibleScope(
    (await cookies()).get(BIBLE_SCOPE_COOKIE)?.value,
  );
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    [
      textParam("language", "eng"),
      textParam("abbreviation", "engKJV"),
      textParam("name", "King James"),
      textParam(
        "ids",
        "de4e12af7f28f599-01",
        scope === "selected" ? SELECTED_BIBLE_IDS.join(",") : "",
      ),
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
        route
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
      <InfoSection requestUrl={exchange?.request.url} />

      <QueryParamsSection params={queryParams} />
      <JSONSection json={body} exchange={exchange} />

      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-12 pt-8 text-sm">
        Bibles in the list
        <BibleScopeSwitch initialScope={scope} />
      </div>
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
