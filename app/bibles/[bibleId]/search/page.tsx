import { Code, Guide, Lead, Note } from "@/components/InfoText";
import { Page } from "@/components/Page";
import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { getDemoBible } from "@/utils/getDemoBible";
import { Search } from "lucide-react";

export const dynamic = "force-static";

type SearchPageProps = {
  params: Promise<{ bibleId: string }>;
};

/**
 * Search selection page. Provides a list of preselected search options for the user to test out our search functionality.
 *
 * See our [Search Guide](https://docs.api.bible/guides/search) for more.
 *
 * *Note: You cannot call the  `/search` endpoint in the API without a `query` attached to it, this is simply a utility page to reduce API usage.*
 */
export default async function SearchPage(props: SearchPageProps) {
  const { bibleId } = await props.params;

  //Get this bible from the list of bibles, fetched once from the `/bibles` endpoint
  const bible = await getDemoBible(bibleId);

  const values = [
    ["Aaron", "name"],
    ["l?ve", "single-wildcard"],
    ["wo*d", "wildcard"],
    ["John 3:16-19", "verse-range"],
  ];

  return (
    <Page>
      <HeaderSection
        bible={bible}
        actionItems={values.map(([value, href]) => ({
          title: `Search "${value}"`,
          href: `/bibles/${bibleId}/search/${href}`,
          children: <Search size={16} className="mr-1" />,
        }))}
      />

      <InfoSection
        title="How to Search"
        info={
          <>
            <Lead>
              A search finds the verses that contain all the keywords in the
              query. The query can be a verse range (for example,{" "}
              {'"John 3:16-19"'}) or one keyword (for example, {'"love"'}). It
              can also be a list of keywords with commas between them (for
              example, {'"love,world"'}).
            </Lead>
            <Lead>
              The sequence of the keywords is not important. But{" "}
              <i>a verse is a result only if it contains all the keywords</i>.
              If the query is a verse range, the API gives the <b>passage</b>.
              For more information, refer to the{" "}
              <Guide href="https://docs.api.bible/guides/search">
                Search Guide
              </Guide>
              .
            </Lead>
            <Note>
              You can use wildcard characters. <Code>*</Code> is for zero or
              more characters. <Code>?</Code> is for one character.
            </Note>
          </>
        }
      />
    </Page>
  );
}
