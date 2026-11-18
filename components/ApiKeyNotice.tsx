import { Code, Guide } from "@/components/InfoText";
import { KeyRound } from "lucide-react";

/**
 * Tells the user that the API.Bible API key is not set, and how to set it. The home
 * page shows this notice. The proxy (see proxy.ts) sends the user to the home page
 * from each page that needs the key.
 */
export const ApiKeyNotice = () => {
  return (
    <div className="w-full px-4 py-3 border-line border-b-[1px]">
      <section
        aria-labelledby="api-key-notice-title"
        className="rounded-md bg-accent-soft border-accent border-[1px] px-4 py-3 flex gap-4"
      >
        <KeyRound
          size={16}
          aria-hidden="true"
          className="shrink-0 mt-1 text-accent"
        />
        <div className="flex flex-col gap-2 text-sm">
          <h2 id="api-key-notice-title" className="text-base font-bold">
            The API key is not set
          </h2>
          <p>
            The demo cannot get data from API.Bible without an API key. The
            pages of the demo are not available until you set the key.
          </p>
          <ol className="list-decimal pl-5 flex flex-col gap-1">
            <li>
              Copy the <Code>.env.example</Code> file to a new file with the
              name <Code>.env</Code>.
            </li>
            <li>
              In the <Code>.env</Code> file, set <Code>API_BIBLE_API_KEY</Code>{" "}
              to your API key.
            </li>
            <li>Stop the application, then start it again.</li>
          </ol>
          <p>
            To get an API key, refer to the{" "}
            <Guide href="https://docs.api.bible/quick-start/authentication">
              authentication guide
            </Guide>
            .
          </p>
        </div>
      </section>
    </div>
  );
};
