import reference from "@/parity/api-reference.json";

/**
 * Reads the snapshot of the API reference that API.Bible publishes
 * (parity/api-reference.json). `npm run parity:update` writes the snapshot.
 *
 * The demo takes its help text and the default values of query parameters from the
 * snapshot, so they agree with the API reference. The parity check fails when the
 * published reference changes (see scripts/parity.mjs).
 */

export type ReferenceParameter = {
  /** The permitted values, for a parameter with fixed values */
  values?: string[];
  default?: string;
  description?: string;
};

export type ReferenceEndpoint = {
  methods: string[];
  /** Short name of the endpoint, for example "Get a Verse" */
  summary?: string;
  /** Full description of the endpoint, in Markdown */
  description?: string;
  /** Query parameters */
  parameters: Record<string, ReferenceParameter>;
  /** Description of each ID in the path, for example `verseId` */
  pathParameters?: Record<string, string>;
};

const ENDPOINTS = Object.entries(
  reference.endpoints as Record<string, ReferenceEndpoint>,
).map(([path, endpoint]) => ({
  /** Path of the endpoint with placeholders, for example `/bibles/{bibleId}/books` */
  path,
  endpoint,
  //`/bibles/{bibleId}/books` becomes a pattern that agrees with `/v1/bibles/<an ID>/books`.
  //The version is optional, so the pattern also agrees with the path of a demo page.
  pattern: new RegExp(
    `^(?:/v\\d+)?${path
      .split("/")
      .map((part) => (/^\{.+\}$/.test(part) ? "[^/]+" : part))
      .join("/")}$`,
  ),
}));

/**
 * Finds the endpoint of the reference for a path.
 *
 * @param pathname  Path of an API request, or of a demo page (the two agree)
 */
export const findEndpoint = (pathname: string) =>
  ENDPOINTS.find(({ pattern }) => pattern.test(pathname));

/** Gets an endpoint of the reference by its path with placeholders */
export const getEndpoint = (path: string): ReferenceEndpoint | undefined =>
  ENDPOINTS.find((item) => item.path === path)?.endpoint;

//The endpoint whose description defines each part of the Bible. The key is the word in a route.
const DEFINING_ENDPOINT: Record<string, string> = {
  bibles: "/bibles/{bibleId}",
  books: "/bibles/{bibleId}/books/{bookId}",
  chapters: "/bibles/{bibleId}/chapters/{chapterId}",
  verses: "/bibles/{bibleId}/verses/{verseId}",
  passages: "/bibles/{bibleId}/passages/{passageId}",
  sections: "/bibles/{bibleId}/sections/{sectionId}",
  search: "/bibles/{bibleId}/search",
};

/**
 * Returns the paragraph of the reference that says what a part of the Bible is, for
 * example what a `Verse` is and how its ID is made. Returns Markdown.
 *
 * The reference has no separate definitions, so this takes the paragraph that contains
 * "object represents" from the description of the endpoint that gets one such object.
 * It removes a last sentence that introduces a table ("A few examples are:").
 *
 * @param word  A word in a route: `bibles`, `books`, `chapters`, `verses`, `passages`, `sections` or `search`
 */
export const resourceDefinition = (word: string): string | undefined => {
  const description = getEndpoint(DEFINING_ENDPOINT[word])?.description;
  if (!description) {
    return undefined;
  }
  const paragraphs = description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    //A line of a table is not a definition
    .filter((paragraph) => paragraph && !paragraph.startsWith("|"));
  const definition =
    paragraphs.find((paragraph) => paragraph.includes("object represents")) ??
    paragraphs[0];

  return definition?.replace(/\s[^.]*:$/, "");
};
