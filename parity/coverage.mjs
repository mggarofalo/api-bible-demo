/**
 * Coverage manifest: the contract between the API.Bible API reference and this demo.
 *
 * The authority is the API reference that API.Bible publishes (an OpenAPI document).
 * `parity/api-reference.json` is a snapshot of its endpoints and query parameters.
 * Each key of this manifest is an endpoint path from that reference. Each value says
 * how the demo shows the endpoint, or why it does not. `scripts/parity.mjs` reads
 * both files and fails when the reference, this manifest and the demo do not agree.
 *
 * When the reference gets a new endpoint or a new query parameter, the parity check
 * fails until the change is added here, in one of two ways:
 *   - Covered: add a page (or a control on a page) and describe it here.
 *   - Deferred: add `deferred: "<reason>"`, to record that the gap is known.
 *
 * Entry fields:
 *   ids       Sample values for the IDs in the path, for the live check. The demo page
 *             has the same path as the endpoint, so these also give the page to load.
 *   sdk       The SDK method (`resource.method`) that the page calls for this endpoint.
 *   params    The query parameters of the endpoint. The key is the name in the API. The value is:
 *               sample    A value for the live check, different from the default of the page.
 *               page      Name of the parameter in the URL of the demo page, if different.
 *               expect    Value in the API request, if different from `sample`.
 *               deferred  Reason that the demo has no control for this parameter.
 *   deferred  Reason that the demo does not show this endpoint.
 */

//Sample IDs for the live check. All are public-domain Bibles on the Starter plan.
const KJV = "de4e12af7f28f599-01"; //King James (Authorised) Version
const WEB = "9879dbb7cfe39e4d-01"; //World English Bible
const SECTIONS = "bba9f40183526463-01"; //Berean Standard Bible, which has section headings

//Query parameters of all endpoints that give verse text
const CONTENT = {
  "content-type": { sample: "text" },
  "include-notes": { sample: "true" },
  "include-titles": { sample: "false" },
  "include-chapter-numbers": { sample: "true" },
  "include-verse-numbers": { sample: "false" },
  "include-verse-spans": { sample: "false" },
  parallels: { sample: WEB },
};

const AUDIO = "Audio Bibles are a future feature of this demo.";

export const coverage = {
  "/bibles": {
    sdk: "bibles.list",
    params: {
      language: { sample: "eng" },
      abbreviation: { sample: "engKJV" },
      name: { sample: "King James" },
      ids: { sample: KJV },
      "include-full-details": { sample: "true" },
    },
  },
  "/bibles/{bibleId}": { sdk: "bibles.get", ids: { bibleId: KJV } },

  "/bibles/{bibleId}/books": {
    sdk: "books.list",
    ids: { bibleId: SECTIONS },
    params: {
      "include-chapters": { sample: "false" },
      "include-chapters-and-sections": { sample: "true" },
    },
  },
  "/bibles/{bibleId}/books/{bookId}": {
    sdk: "books.get",
    ids: { bibleId: KJV, bookId: "GEN" },
    //The page asks for chapters by default, so the sample turns them off
    params: { "include-chapters": { sample: "false" } },
  },
  "/bibles/{bibleId}/books/{bookId}/chapters": {
    sdk: "chapters.list",
    ids: { bibleId: KJV, bookId: "GEN" },
  },
  "/bibles/{bibleId}/books/{bookId}/sections": {
    sdk: "sections.listForBook",
    ids: { bibleId: SECTIONS, bookId: "GEN" },
  },

  "/bibles/{bibleId}/chapters/{chapterId}": {
    sdk: "chapters.get",
    ids: { bibleId: KJV, chapterId: "GEN.1" },
    params: {
      ...CONTENT,
      //The chapter page asks for notes by default, so the sample turns them off
      "include-notes": { sample: "false" },
    },
  },
  "/bibles/{bibleId}/chapters/{chapterId}/verses": {
    sdk: "verses.list",
    ids: { bibleId: KJV, chapterId: "GEN.1" },
  },
  "/bibles/{bibleId}/chapters/{chapterId}/sections": {
    sdk: "sections.listForChapter",
    ids: { bibleId: SECTIONS, chapterId: "GEN.1" },
  },

  "/bibles/{bibleId}/verses/{verseId}": {
    sdk: "verses.get",
    ids: { bibleId: KJV, verseId: "GEN.1.1" },
    params: { ...CONTENT, "use-org-id": { sample: "true" } },
  },
  "/bibles/{bibleId}/passages/{passageId}": {
    sdk: "passages.get",
    ids: { bibleId: KJV, passageId: "GEN.1.1-GEN.1.3" },
    params: { ...CONTENT, "use-org-id": { sample: "true" } },
  },
  "/bibles/{bibleId}/sections/{sectionId}": {
    sdk: "sections.get",
    ids: { bibleId: SECTIONS, sectionId: "GEN.S1" },
    params: CONTENT,
  },

  "/bibles/{bibleId}/search": {
    sdk: "search.search",
    ids: { bibleId: KJV },
    params: {
      query: { sample: "Aaron" },
      limit: { sample: "25" },
      //The demo counts pages of results. Page 1 with a limit of 25 is an offset of 25.
      offset: { page: "page", sample: "1", expect: "25" },
      sort: { sample: "canonical" },
      range: { sample: "exo-deu" },
      fuzziness: { sample: "1" },
    },
  },

  "/audio-bibles": { deferred: AUDIO },
  "/audio-bibles/{bibleId}": { deferred: AUDIO },
  "/audio-bibles/{bibleId}/books": { deferred: AUDIO },
  "/audio-bibles/{bibleId}/books/{bookId}": { deferred: AUDIO },
  "/audio-bibles/{bibleId}/books/{bookId}/chapters": { deferred: AUDIO },
  "/audio-bibles/{bibleId}/chapters/{chapterId}": { deferred: AUDIO },
};
