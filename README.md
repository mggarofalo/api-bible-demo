## API.Bible NextJS Demo Application

Welcome to the API.Bible NextJS demo application! This application was built to give you examples of how our API can be used to display Bible content. The URL structure of this application is intended to match that of our API to help you get familiar with how Bible data is queried. Along with the accompanying API results, each page will include a quick guide to querying the data that is being shown. If you want more details about our platform, be sure to check out our [documentation](https://docs.api.bible).

You can view the live demo app [here](https://demo.api.bible).

### Project Overview

#### Tech Stack

This app was built using the following technologies:

- [Next.js (App Router)](https://nextjs.org)
- [Typescript](https://www.typescriptlang.org)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

#### Making Calls to API.Bible

This app uses the NodeJS `fetch` function to make calls to API.Bible. You can find more information in the [api.ts](./utils/api.ts) file. Detailed guides about each API endpoint can be found in our [documentation](https://docs.api.bible/guides/bibles) or our [API reference](https://api.bible/api-reference).

Since this app is using NextJS, all API calls are made on the server-side. This protects its API key and allows the opportunity to cache those requests. For your own application, it is recommended to use a similar pattern, as using your API key in a client-side application (html/javascript, basic React, etc.) will expose your API key.

Caching requests also allows this app to throttle the number of API calls it makes in a given month. A full standard Bible has over 31,000 verses, so minimizing duplicate API calls is extremely important (especially during active development).

#### Structure

As mentioned earlier, the structure of this app is designed to mimic the API. Where an API endpoint exists, a page exists with details on the endpoint and the result of the API call. If you want more details on a specific page, you can search the [app](./app/) directory. We will also provide a quick guide below:

| API Endpoint                                      | Corresponding File                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/bibles`                                         | [app/bibles/page.tsx](./app/bibles/page.tsx)                                                                                 |
| `/bibles/{bibleId}`                               | [app/bibles/[bibleId]/page.tsx](./app/bibles/[bibleId]/page.tsx)                                                             |
| `/bibles/{bibleId}/books`                         | [app/bibles/[bibleId]/books/page.tsx](./app/bibles/[bibleId]/books/page.tsx)                                                 |
| `/bibles/{bibleId}/books/{bookId}`                | [app/bibles/[bibleId]/books/[bookId]/page.tsx](./app/bibles/[bibleId]/books/[bookId]/page.tsx)                               |
| `/bibles/{bibleId}/books/{bookId}/chapters`       | [app/bibles/[bibleId]/books/[bookId]/chapters/page.tsx](./app/bibles/[bibleId]/books/[bookId]/chapters/page.tsx)             |
| `/bibles/{bibleId}/books/{bookId}/sections`       | [app/bibles/[bibleId]/books/[bookId]/sectionspage.tsx](./app/bibles/[bibleId]/books/[bookId]/sections/page.tsx)              |
| `/bibles/{bibleId}/chapters/{chapterId}`          | [app/bibles/[bibleId]/chapters/[chapterId]/page.tsx](./app/bibles/[bibleId]/chapters/[chapterId]/page.tsx)                   |
| `/bibles/{bibleId}/chapters/{chapterId}/sections` | [app/bibles/[bibleId]/chapters/[chapterId]/sections/page.tsx](./app/bibles/[bibleId]/chapters/[chapterId]/sections/page.tsx) |
| `/bibles/{bibleId}/chapters/{chapterId}/verses`   | [app/bibles/[bibleId]/chapters/[chapterId]/verses/page.tsx](./app/bibles/[bibleId]/chapters/[chapterId]/verses/page.tsx)     |
| `/bibles/{bibleId}/passages/{passageId}`          | [app/bibles/[bibleId]/passages/[passageId]/page.tsx](./app/bibles/[bibleId]/passages/[passageId]/page.tsx)                   |
| `/bibles/{bibleId}/search`                        | [app/bibles/[bibleId]/search/page.tsx](./app/bibles/[bibleId]/search/page.tsx)                                               |
| `/bibles/{bibleId}/sections/{sectionId}`          | [app/bibles/[bibleId]/sections/[sectionId]/page.tsx](./app/bibles/[bibleId]/sections/[sectionId]/page.tsx)                   |
| `/bibles/{bibleId}/verses/{verseId}`              | [app/bibles/[bibleId]/verses/[verseId]/page.tsx](./app/bibles/[bibleId]/verses/[verseId]/page.tsx)                           |

#### What Each Page Shows

Each page that calls the API shows, under its header:

- **Query Parameters**: a control for every query parameter of the endpoint. A change goes into the URL of the page, the server sends the request again, and the page shows the new result.
- **Request** and **Response**: the HTTP request that the server sent (the API key is not shown) and the status, time and headers of the response. The request does not contain a query parameter that has the default value of the API. The defaults come from the snapshot of the API reference.
- **Raw JSON Output**: the body of the response.

To move through a Bible, use the sidebar (the `>>` button at the top left), or click the Bible or the reference in the header. The reference opens a form that selects a book, a chapter, a verse or a range of verses.

### Economy of API Calls

The demo runs on the live API, so it makes as few calls as possible:

- **Each different request calls the API one time.** The demo keeps each response in the data cache of Next.js for one day. A second view of the same page, or a different page that makes the same request, makes no call. The Response section of a page says when its response came from the cache. Set the `API_CACHE_SECONDS` environment variable to change the time. The value `0` stops the cache.
- **Links do not prefetch.** A page makes calls only for itself.
- **The sidebar gets the verses of a chapter only when it is open.**
- **The demo makes one attempt for each request.** It does not try again after an error.
- **`robots.txt` keeps crawlers away from URLs with query parameters**, and from the pages for each verse, passage, section and search.

A view of a page that the demo saw before makes no call to the API. A first view of a verse or a chapter makes one call. The first page that a new server shows makes two more calls, for the list of Bibles and the list of books in the sidebar.

### Fair Use Reports (FUMS)

API.Bible gives a `fumsToken` in the `meta` of each response that contains Scripture. A web application must send each token back to the [Fair Use Management System](https://docs.api.bible/resources/fair-use) (FUMS). The demo does this as the documentation says:

- The root layout loads the FUMS script (`https://pkg.api.bible/fumsV3.min.js`) and the small shim that makes the `fums` function before the script loads.
- Each page that shows a response with a token calls `fums("trackView", token)` each time the page shows. See [utils/fums.ts](./utils/fums.ts).
- The demo has no users, so it gives FUMS a fixed sample user ID. A real application gives the ID of the logged-in user, without personal data, or no ID.

A small panel at the bottom right of the window shows each report as four steps: the token from the API, the call to the script, the IDs that the script added (device, session and user), and the request to the FUMS server. The reports are real reports for the API calls of your key.

### Keeping the Demo in Sync

The demo must show all that the API can do, and continue to do so when the API changes. The authority is the [API reference](https://api.bible/api-reference) that API.Bible publishes, which is an OpenAPI document at `https://rest.api.bible/v1/swagger.json`. Three files make this a check that a machine can run:

- [parity/api-reference.json](./parity/api-reference.json) is a snapshot of the reference: each endpoint, with its query parameters and their fixed values.
- [parity/coverage.mjs](./parity/coverage.mjs) is the coverage manifest. For each endpoint of the reference it gives the query parameters that the demo page shows, or the reason that the demo does not show the endpoint yet.
- [scripts/parity.mjs](./scripts/parity.mjs) compares the reference, the manifest and the demo, and fails when they do not agree.

```sh
npm run parity          # static checks: no server, network or API key necessary
npm run parity:live     # also checks the published reference and each page of a running demo
npm run parity:update   # gets the published reference and writes the snapshot again
```

| Check         | What it compares                                                                   | A failure means                                                     |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Endpoints  | The endpoints of the snapshot and the entries of the manifest                      | The manifest does not account for an endpoint                       |
| 2. Parameters | The query parameters of the snapshot and those of the manifest                     | The manifest does not account for a parameter                       |
| 3. Source     | The manifest and the source code: a page at the same path, a control per parameter | A page or a control is gone, or a fixed value has no option         |
| 4. Reference  | The published reference and the snapshot (live)                                    | The API changed. Update the snapshot, then run the static checks    |
| 5. Pages      | The API request that each page sends, with every parameter set (live)              | A control does not reach the API, or the API refuses a valid request |

The help text of the demo is the text of the reference: the summary and the description of each endpoint, and the description of each parameter. The demo reads them from the snapshot and shows the words with no changes. Check 2 fails if the reference has no text for an endpoint or a parameter, check 4 fails if the published text changes, and check 5 fails if a page does not show the text.

When the API changes, check 4 fails first. Run `npm run parity:update`, and then checks 1 to 3 list what the demo does not show yet. There are two ways to make them pass: add the page or the control and describe it in the manifest, or add a `deferred` reason to the manifest. Thus each gap is a decision that is in the repository, and not an omission.

The demo calls the API through the [API.Bible SDK](https://www.npmjs.com/package/@americanbible/api-bible-sdk), but the SDK is not the authority. Where the API has a parameter that the SDK does not (at this time, `use-org-id`), the demo adds the parameter to the request (see `traced` in [utils/api.ts](./utils/api.ts)).

The [Parity workflow](./.github/workflows/parity.yml) runs the static checks on every push and pull request. It runs the live checks each night. The live checks need the repository secret `API_BIBLE_API_KEY`.

### Local Setup

This application has been configured to minimize local setup time. To get this application running locally, follow the steps below:

1. First, you will need to copy the [example .env](./.env.example) file into a new `.env` file.

2. Replace the `API_BIBLE_API_KEY` environment variable with your API.Bible API key. See the [authentication](https://docs.api.bible/quick-start/authentication) quick start guide for information on how to retrieve your API key.

3. Run the following:

```sh
npm run dev
```

4. Your application should now be running on `localhost:3000`

The lists of Bibles show a short list by default: the Bibles in [demoBibles.ts](./utils/demoBibles.ts). A switch on the Bibles page, and in the list of Bibles in the header, changes to all the Bibles that your API key can access. A Bible that is not in the short list stays available by its URL.

### Future Updates

This application is still a work in progress. In the near future we hope to provide the following features:

1. Audio Bible support
