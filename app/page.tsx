import { HeaderSection } from "@/components/sections/HeaderSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { LinkButton } from "@/components/LinkButton";
import { TextSection } from "@/components/sections/TextSection";
import { BookOpenText } from "lucide-react";
import { Guide } from "@/components/InfoText";

/**
 * Home page of the application. */
export default async function HomePage() {
  return (
    <div className="flex flex-col">
      <HeaderSection
        title="API.Bible NextJS Demo"
        breadcrumbs={[
          {
            title: "Home",
            href: "/",
          },
        ]}
      />
      <InfoSection
        title="What is API.Bible?"
        url="https://api.bible"
        info={
          <>
            <p className="text-sm">
              API.Bible is a tool for developers. It{" "}
              <b>gives access to a large catalog of Bibles through an API</b>.
              The catalog includes well-known translations such as NIV, NKJV,
              NASB, The Message, CST, NLT, The Amplified Bible and GNT.
            </p>
            <p className="text-sm mt-2">
              Before API.Bible, it was difficult and slow to get a license for a
              Bible. A developer did this procedure again for each translation.
              API.Bible removes this problem for digital Bibles. We work with
              many copyright owners, and we have a large catalog of open-access
              Bibles.{" "}
              <b>
                One license gives you all that is necessary to put the Bible
                into your app.
              </b>
            </p>
          </>
        }
      />
      <TextSection>
        <h3 className="text-2xl font-bold">WELCOME.</h3>
        <p>
          This application shows how the API operates. The URLs of its pages
          agree with the URLs of the API. Each page shows the API result and a
          short guide to the request. For more information about the platform,
          refer to our{" "}
          <Guide href="https://docs.api.bible">documentation</Guide>.
        </p>
        <p className="text-sm">
          To see how we made this application, refer to our public{" "}
          <Guide href="https://github.com/americanbible/api-bible-demo">
            GitHub repository
          </Guide>
          .
        </p>
        <div className="w-full flex justify-center mt-8">
          <LinkButton
            title="Start the Demo"
            href="/bibles"
            className="border-[1px] text-lg gap-4"
          >
            <BookOpenText size={16} />
          </LinkButton>
        </div>
      </TextSection>
    </div>
  );
}
