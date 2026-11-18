import { demoBibles } from "./demoBibles";

/**
 * The Bible scope: which Bibles the lists of the demo show.
 *   - `selected` (default): a short list of Bibles (see demoBibles.ts)
 *   - `all`: all the Bibles that the API key can access
 *
 * The scope is in a cookie, so the server can read it for the Bibles page and the
 * browser can read it for the lists in the header. A Bible that is not in the short
 * list stays available by its URL in both scopes.
 */
export type BibleScope = "selected" | "all";

export const BIBLE_SCOPE_COOKIE = "bible-scope";

/** IDs of the Bibles in the short list */
export const SELECTED_BIBLE_IDS = demoBibles.map(({ id }) => id);

export const parseBibleScope = (value: string | undefined): BibleScope =>
  value === "all" ? "all" : "selected";
