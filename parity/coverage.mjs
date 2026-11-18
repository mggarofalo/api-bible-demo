/**
 * Coverage manifest: the contract between the API.Bible SDK and this demo.
 *
 * Each key is a method of the SDK client (`resource.method`). Each value says where
 * the demo shows that method, or why it does not. `scripts/parity.mjs` reads this file
 * and fails when the SDK, this manifest and the demo do not agree.
 *
 * When the SDK gets a new method or a new parameter, the parity check fails until
 * the change is added here, in one of two ways:
 *   - Covered: add a page (or a control on a page) and describe it here.
 *   - Deferred: add `deferred: "<reason>"`, to record that the gap is known.
 *
 * Entry fields:
 *   route     Path of the demo page that calls the method, with sample IDs. Because the
 *             paths of the demo agree with the paths of the API, this is also the path
 *             of the API request (after `/v1`).
 *   params    The parameters of the method. The key is the name in the SDK. The value is:
 *               name      Name of the query parameter in the URL of the demo page. Unless
 *                         `wire` is given, the API uses the same name.
 *               sample    A value for the live check, different from the default of the page.
 *               wire      Name of the query parameter in the API request, if different.
 *               expect    Value in the API request, if different from `sample`.
 *               deferred  Reason that the demo has no control for this parameter.
 *   deferred  Reason that the demo does not show this method.
 */

//Sample IDs for the live check. All are public-domain Bibles on the Starter plan.
const KJV = "de4e12af7f28f599-01"; //King James (Authorised) Version
const WEB = "9879dbb7cfe39e4d-01"; //World English Bible
const SECTIONS = "bba9f40183526463-01"; //Berean Standard Bible, which has section headings

//Parameters of all endpoints that give verse text
const CONTENT = {
  contentType: { name: "content-type", sample: "text" },
  includeNotes: { name: "include-notes", sample: "true" },
  includeTitles: { name: "include-titles", sample: "false" },
  includeChapterNumbers: { name: "include-chapter-numbers", sample: "true" },
  includeVerseNumbers: { name: "include-verse-numbers", sample: "false" },
  includeVerseSpans: { name: "include-verse-spans", sample: "false" },
  parallels: { name: "parallels", sample: WEB },
};

const AUDIO = "Audio Bibles are a future feature of this demo.";

export const coverage = {
  "bibles.list": {
    route: "/bibles",
    params: {
      language: { name: "language", sample: "eng" },
      abbreviation: { name: "abbreviation", sample: "engKJV" },
      name: { name: "name", sample: "King James" },
      ids: { name: "ids", sample: KJV },
      includeFullDetails: { name: "include-full-details", sample: "true" },
    },
  },
  "bibles.get": { route: `/bibles/${KJV}` },

  "books.list": {
    route: `/bibles/${SECTIONS}/books`,
    params: {
      includeChapters: { name: "include-chapters", sample: "false" },
      includeChaptersAndSections: {
        name: "include-chapters-and-sections",
        sample: "true",
      },
    },
  },
  "books.get": {
    route: `/bibles/${KJV}/books/GEN`,
    params: {
      //The page asks for chapters by default, so the sample turns them off
      includeChapters: { name: "include-chapters", sample: "false" },
    },
  },

  "chapters.list": { route: `/bibles/${KJV}/books/GEN/chapters` },
  "chapters.get": {
    route: `/bibles/${KJV}/chapters/GEN.1`,
    params: {
      ...CONTENT,
      //The chapter page asks for notes by default, so the sample turns them off
      includeNotes: { name: "include-notes", sample: "false" },
    },
  },

  "verses.list": { route: `/bibles/${KJV}/chapters/GEN.1/verses` },
  "verses.get": { route: `/bibles/${KJV}/verses/GEN.1.1`, params: CONTENT },

  "passages.get": {
    route: `/bibles/${KJV}/passages/GEN.1.1-GEN.1.3`,
    params: CONTENT,
  },

  "sections.listForBook": { route: `/bibles/${SECTIONS}/books/GEN/sections` },
  "sections.listForChapter": {
    route: `/bibles/${SECTIONS}/chapters/GEN.1/sections`,
  },
  "sections.get": {
    route: `/bibles/${SECTIONS}/sections/GEN.S1`,
    params: CONTENT,
  },

  "search.search": {
    route: `/bibles/${KJV}/search`,
    params: {
      query: { name: "query", sample: "Aaron" },
      limit: { name: "limit", sample: "25" },
      //The demo counts pages of results. Page 1 with a limit of 25 is an offset of 25.
      offset: { name: "page", sample: "1", wire: "offset", expect: "25" },
      sort: { name: "sort", sample: "canonical" },
      range: { name: "range", sample: "exo-deu" },
      fuzziness: { name: "fuzziness", sample: "1" },
    },
  },

  "audioBibles.list": { deferred: AUDIO },
  "audioBibles.get": { deferred: AUDIO },
  "audioBibles.listBooks": { deferred: AUDIO },
  "audioBibles.getBook": { deferred: AUDIO },
  "audioBibles.listChapters": { deferred: AUDIO },
  "audioBibles.getChapter": { deferred: AUDIO },
};
