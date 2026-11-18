import { Code, Guide, Lead, Note } from "@/components/InfoText";
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
  //The API counts results with `offset`. This application counts pages of results.
  const page = Math.max(0, Math.floor(Number(searchParams.page)) || 0);
  //Link to this page with a different page of results, and the same query parameters
  const pageHref = (number: number) =>
    `/bibles/${bibleId}/search${toQueryString(queryParams, number ? { page: String(number) } : {})}`;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Execute a search with the given query using the `/bibles/{bibleId}/search?query={query}` endpoint.
  //The API does not accept a search without a query.
  const search = query
    ? await traced(() =>
        client.search.search(bibleId, {
          query,
          limit,
          offset: page * limit,
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
  const offset = result?.offset ?? page * limit;
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
      <InfoSection
        title="How to Search a Bible"
        url="https://rest.api.bible/v1/bibles/{bibleId}/search?query={query}"
        requestUrl={search?.exchange?.request.url}
        info={
          <>
            <Lead>
              To search a Bible, send a <Code>GET</Code> request to this API
              endpoint. Put the <b>Bible ID</b> in the URL. Put the search words
              in the <Code>query</Code> query parameter. For more information,
              refer to the{" "}
              <Guide href="https://docs.api.bible/guides/search">
                Search Guide
              </Guide>
              .
            </Lead>
            <Lead>
              The query can be a verse range (for example, {'"John 3:16-19"'})
              or one keyword (for example, {'"love"'}). It can also be a list of
              keywords with commas between them (for example,{" "}
              {'"love,world"'}). The sequence of the keywords is not important.
              But <i>a verse is a result only if it contains all the keywords</i>
              . If the query is a verse range, the API gives the <b>passage</b>.
            </Lead>
            <Note>
              You can use wildcard characters. <Code>*</Code> is for zero or
              more characters. <Code>?</Code> is for one character. The{" "}
              <Code>text</Code> property of each result contains only the text
              of the verse. To get the footnotes and the format data of a verse,{" "}
              <Guide href="https://docs.api.bible/guides/verses#fetching-a-single-verse">
                get that verse
              </Guide>
              .
            </Note>
          </>
        }
      />

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
            {page > 0 && !passages.length && (
              <>
                <LinkButton
                  tab
                  className="sm:hidden"
                  href={pageHref(page - 1)}
                  title=""
                >
                  <ArrowLeftCircle size={16} />
                </LinkButton>
                <LinkButton
                  tab
                  className="hidden sm:flex"
                  href={pageHref(page - 1)}
                  title="Previous"
                />
              </>
            )}
            {offset + verses.length < total && (
              <>
                <LinkButton
                  tab
                  className="sm:hidden"
                  href={pageHref(page + 1)}
                  title=""
                >
                  <ArrowRightCircle size={16} />
                </LinkButton>
                <LinkButton
                  tab
                  className="hidden sm:flex"
                  href={pageHref(page + 1)}
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
