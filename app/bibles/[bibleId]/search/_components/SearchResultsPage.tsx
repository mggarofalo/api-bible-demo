import { HeaderSection } from "@/components/sections/HeaderSection";
import { ListSection } from "@/components/sections/ListSection";
import { LinkButton } from "@/components/LinkButton";
import { ArrowLeftCircle, ArrowRightCircle, Search } from "lucide-react";
import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { InfoSection } from "@/components/sections/InfoSection";
import { JSONSection } from "@/components/sections/JSONSection";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { Page } from "@/components/Page";
import { Spacer } from "@/components/Spacer";
import { client, traced } from "@/utils/api";
import { getDemoBible } from "@/utils/getDemoBible";
import {
  PageSearchParams,
  paramValue,
  readParams,
  toQueryString,
} from "@/utils/queryParams";
import { Bible, SearchParams } from "@americanbible/api-bible-sdk";

type SearchResultsPageProps = {
  bibleId: string;
  page: number;
  searchValue: string;
  searchLink: string;
  searchParams: PageSearchParams;
};

/**
 * Componentized search results page. Executes a search and lists all content returned.
 * If a passage is searched, it will display those results properly as well.
 *
 * See our [Search Guide](https://docs.api.bible/guides/search) for more.
 */
export async function SearchResultsPage({
  bibleId,
  page,
  searchValue,
  searchLink,
  searchParams,
}: SearchResultsPageProps) {
  //Read the query parameters that the user selected on the page
  const queryParams = readParams(
    [
      { name: "limit", options: ["10", "25", "50"], defaultValue: "10" },
      {
        name: "sort",
        options: ["relevance", "canonical", "reverse-canonical"],
        defaultValue: "relevance",
      },
      {
        name: "fuzziness",
        options: ["AUTO", "0", "1", "2"],
        defaultValue: "AUTO",
      },
    ],
    searchParams,
  );
  const PAGE_SIZE = Number(paramValue(queryParams, "limit"));
  //Link to a different page of results, with the same query parameters
  const pageHref = (number: number) =>
    `/bibles/${bibleId}/search/${searchLink}${toQueryString(queryParams, { page: String(number) })}`;
  //Get this bible from the demo bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);
  //Execute a search with the given query using the `/bibles/{bibleId}/search?query={query}` endpoint
  const {
    data: result,
    exchange,
    body,
  } = await traced(() =>
    client.search.search(bibleId, {
      query: searchValue,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      sort: paramValue(queryParams, "sort") as SearchParams["sort"],
      fuzziness: paramValue(
        queryParams,
        "fuzziness",
      ) as SearchParams["fuzziness"],
    }),
  );

  if (result.verses?.length && !result.passages?.length) {
    //The SDK types these as optional, so fall back to what this page already knows
    const offset = result.offset ?? page * PAGE_SIZE;
    const total = result.total ?? offset + result.verses.length;

    const previousButtonVisible = page > 0;
    const nextButtonVisible = result.verses?.length === PAGE_SIZE;

    return (
      <Page>
        <SearchResultHeader bible={bible} />
        <QueryParamsSection params={queryParams} />
        <JSONSection json={body} exchange={exchange} />
        <div className="w-full h-8" />
        <div className="flex items-end border-black border-b-[1px] px-0 sm:px-8 sticky top-[-1px] bg-white">
          <div className="flex flex-col border-x-[1px] border-t-[1px] px-4 py-2">
            <p>
              Query: <b>{`"${searchValue}"`}</b>
            </p>
            <p>
              Results{" "}
              <b>
                {offset + 1}-{Math.min(total, offset + PAGE_SIZE)}
              </b>{" "}
              of <b>{total}</b>.
            </p>
          </div>

          <div className="grow" />
          {previousButtonVisible && (
            <>
              <LinkButton
                className="sm:hidden border-x-[1px] border-t-[1px] h-full"
                href={pageHref(page - 1)}
                title=""
              >
                <ArrowLeftCircle size={16} />
              </LinkButton>
              <LinkButton
                className="hidden sm:flex border-x-[1px] border-t-[1px] h-full"
                href={pageHref(page - 1)}
                title="Previous"
              />
            </>
          )}
          {nextButtonVisible && (
            <>
              <LinkButton
                className={`sm:hidden border-r-[1px] border-t-[1px] h-full ${!previousButtonVisible ? "border-l-[1px]" : ""}`}
                href={pageHref(page + 1)}
                title=""
              >
                <ArrowRightCircle size={16} />
              </LinkButton>
              <LinkButton
                className={`hidden sm:flex border-r-[1px] border-t-[1px] h-full ${!previousButtonVisible ? "border-l-[1px]" : ""}`}
                href={pageHref(page + 1)}
                title="Next"
              />
            </>
          )}
        </div>
        <div className="flex border-b-[1px] ">
          <Spacer />
        </div>

        <div className="flex flex-col gap-4">
          {!result.verses?.length && (
            <p className="self-center justify-self-center">No results.</p>
          )}
          {!!result.verses?.length && (
            <ListSection
              hideHeader
              items={result.verses.map((verse) => ({
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
        </div>
      </Page>
    );
  } else {
    return (
      <Page>
        <SearchResultHeader bible={bible} />
        <QueryParamsSection params={queryParams} />
        <JSONSection json={body} exchange={exchange} />
        <div className="flex border-b-[1px]">
          <Spacer />
          <div className="flex flex-col border-r-[1px] px-4 py-2">
            <p>
              Query: <b>{`"${searchValue}"`}</b>
            </p>
            <p>
              Results: <b>{result.passages?.length}</b>.
            </p>
          </div>
        </div>

        {!!result.passages?.length && (
          <>
            <ListSection
              hideHeader
              items={result.passages.map((passage) => ({
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
          </>
        )}
      </Page>
    );
  }
}

type SearchResultHeaderProps = {
  bible: Bible;
};
const SearchResultHeader = ({ bible }: SearchResultHeaderProps) => {
  return (
    <>
      <HeaderSection
        bible={bible}
        actionItems={[
          {
            title: "Select a Different Query",
            href: `/bibles/${bible.id}/search`,
            children: <Search size={16} />,
          },
        ]}
      />
      <InfoSection
        title="How to Search a Bible"
        url="https://rest.api.bible/v1/bibles/{bibleId}/search?query={query}"
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
            <Note>
              The <Code>text</Code> property of each result contains only the
              text of the verse. It does not contain footnote references or
              format data. To get more data about a verse,{" "}
              <Guide href="https://docs.api.bible/guides/verses#fetching-a-single-verse">
                get that verse
              </Guide>
              .
            </Note>
          </>
        }
      />
    </>
  );
};
