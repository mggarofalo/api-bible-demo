import { Code } from "@/components/InfoText";
import { LinkButton } from "@/components/LinkButton";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { ListSection } from "@/components/sections/ListSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { Spacer } from "@/components/Spacer";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";
import {
  PageSearchParams,
  paramText,
  paramValue,
  readParams,
  textParam,
  toQueryString,
} from "@/utils/queryParams";
import { SearchParams } from "@americanbible/api-bible-sdk";
import { ArrowLeftCircle, ArrowRightCircle, Search } from "lucide-react";

type SearchPageProps = {
  params: Promise<{ bibleId: string }>;
  searchParams: Promise<PageSearchParams>;
};

//Example queries, shown as buttons
const EXAMPLES = ["Aaron", "l?ve", "wo*d", "John 3:16-19"];

/**
 * Search page. Searches the Bible for the `query` in the URL of the page, and lists the results.
 * If the query is a verse range, the result is a passage. Without a query, the page shows
 * example queries.
 *
 * See our [Search Guide](https://docs.api.bible/guides/search) for more.
 */
export default async function SearchPage(props: SearchPageProps) {
  const { bibleId } = await props.params;
  const searchParams = await props.searchParams;
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    [
      textParam("query", "love,world"),
      { name: "limit", options: ["10", "25", "50"], defaultValue: "10" },
      textParam("offset", "0", "0"),
      {
        name: "sort",
        options: ["relevance", "canonical", "reverse-canonical"],
        defaultValue: "relevance",
      },
      {
        name: "fuzziness",
        //The API reference gives no default, so the first option sends no value
        options: ["", "AUTO", "0", "1", "2"],
        defaultValue: "",
      },
      //Passage IDs that limit the search, with commas between them
      textParam("range", "gen-deu"),
    ],
    searchParams,
  );
  const query = paramValue(queryParams, "query");
  const limit = Number(paramValue(queryParams, "limit"));
  //The number of results to go past. The "Previous" and "Next" links change it by `limit`.
  const start = Math.max(
    0,
    Math.floor(Number(paramValue(queryParams, "offset"))) || 0,
  );
  //Link to this page with a different `offset`, and the same values for the other parameters
  const offsetHref = (next: number) =>
    `/bibles/${bibleId}/search${toQueryString(
      queryParams.map((param) =>
        param.name === "offset" ? { ...param, value: String(next) } : param,
      ),
    )}`;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Execute a search with the given query using the `/bibles/{bibleId}/search?query={query}` endpoint.
  //The API does not accept a search without a query.
  const search = query
    ? await traced(() =>
        client.search.search(bibleId, {
          query,
          limit,
          offset: start,
          sort: paramValue(queryParams, "sort") as SearchParams["sort"],
          fuzziness: paramText(
            queryParams,
            "fuzziness",
          ) as SearchParams["fuzziness"],
          range: paramText(queryParams, "range"),
        }),
      )
    : null;
  const result = search?.data;
  const verses = result?.verses ?? [];
  const passages = result?.passages ?? [];
  const offset = result?.offset ?? start;
  const total = result?.total ?? offset + verses.length;

  return (
    <Page>
      <HeaderSection
        bible={bible}
        actionItems={EXAMPLES.map((example) => ({
          title: `Search "${example}"`,
          href: `/bibles/${bibleId}/search?query=${encodeURIComponent(example)}`,
          children: <Search size={16} className="mr-1" />,
        }))}
      />
      <InfoSection requestUrl={search?.exchange?.request.url} />

      <QueryParamsSection params={queryParams} />
      {!!search && <JSONSection json={search.body} exchange={search.exchange} />}

      {!search && (
        <p className="p-12 border-zinc-200 border-b-[1px]">
          Type a query in the <Code>query</Code> box, or select an example.
        </p>
      )}

      {!!search && (
        <>
          <div className="w-full h-8" />
          <div className="flex items-end gap-3 border-line border-b-[1px] px-3 sm:px-8 sticky top-[-1px] bg-white">
            <div className="folder-tab flex flex-col px-4 py-2">
              <p>
                Query: <b>{`"${query}"`}</b>
              </p>
              {passages.length ? (
                <p>
                  Results: <b>{passages.length}</b>.
                </p>
              ) : verses.length ? (
                <p>
                  Results{" "}
                  <b>
                    {offset + 1}-{Math.min(total, offset + limit)}
                  </b>{" "}
                  of <b>{total}</b>.
                </p>
              ) : (
                <p>No results.</p>
              )}
            </div>

            <div className="grow" />
            {start > 0 && !passages.length && (
              <>
                <LinkButton
                  tab
                  className="sm:hidden"
                  href={offsetHref(Math.max(0, start - limit))}
                  title=""
                >
                  <ArrowLeftCircle size={16} />
                </LinkButton>
                <LinkButton
                  tab
                  className="hidden sm:flex"
                  href={offsetHref(Math.max(0, start - limit))}
                  title="Previous"
                />
              </>
            )}
            {offset + verses.length < total && (
              <>
                <LinkButton
                  tab
                  className="sm:hidden"
                  href={offsetHref(start + limit)}
                  title=""
                >
                  <ArrowRightCircle size={16} />
                </LinkButton>
                <LinkButton
                  tab
                  className="hidden sm:flex"
                  href={offsetHref(start + limit)}
                  title="Next"
                />
              </>
            )}
          </div>
          <div className="flex border-b-[1px]">
            <Spacer />
          </div>

          {!!passages.length && (
            <ListSection
              hideHeader
              items={passages.map((passage) => ({
                title: (
                  <div className="flex flex-col pb-2">
                    <p className="text-sm">
                      <b>{passage.reference}</b>
                    </p>
                    <div
                      className="scripture-styles"
                      dangerouslySetInnerHTML={{ __html: passage.content ?? "" }}
                    />
                  </div>
                ),
                info: passage.id,
                href: `/bibles/${bibleId}/passages/${passage.id}`,
              }))}
            />
          )}
          {!passages.length && !!verses.length && (
            <ListSection
              hideHeader
              items={verses.map((verse) => ({
                title: (
                  <div className="flex flex-col pb-2">
                    <b className="text-sm">{verse.reference}</b>
                    <p>{verse.text}</p>
                  </div>
                ),
                info: verse.id,
                href: `/bibles/${bibleId}/verses/${verse.id}`,
              }))}
            />
          )}
        </>
      )}
    </Page>
  );
}
