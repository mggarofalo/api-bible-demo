import type { ContentRenderingParams } from "@americanbible/api-bible-sdk";

/**
 * A query parameter of an API.Bible endpoint that the user can change on a page
 */
export type QueryParam = {
  /** Name of the query parameter in the API, for example `content-type` */
  name: string;
  /** Values that the user can select */
  options: readonly string[];
  /** Value that the page uses when the page URL does not give one */
  defaultValue: string;
  /** Value in use now */
  value: string;
};

type ParamDefinition = Omit<QueryParam, "value">;

export type PageSearchParams = Record<string, string | string[] | undefined>;

const BOOLEAN = ["true", "false"] as const;

/**
 * Query parameters of the endpoints that give verse text (chapters, verses, passages
 * and sections). See the [Verse Content Guide](https://docs.api.bible/guides/verses#verse-content).
 *
 * @param defaults  Default values that are different for a page
 */
export const contentParams = (
  defaults: Record<string, string> = {},
): ParamDefinition[] =>
  [
    { name: "content-type", options: ["html", "json", "text"], defaultValue: "html" },
    { name: "include-notes", options: BOOLEAN, defaultValue: "false" },
    { name: "include-titles", options: BOOLEAN, defaultValue: "true" },
    { name: "include-chapter-numbers", options: BOOLEAN, defaultValue: "false" },
    { name: "include-verse-numbers", options: BOOLEAN, defaultValue: "true" },
    { name: "include-verse-spans", options: BOOLEAN, defaultValue: "true" },
  ].map((param) => ({
    ...param,
    defaultValue: defaults[param.name] ?? param.defaultValue,
  }));

/**
 * Reads the values of the given query parameters from the URL of the page. A value
 * that is absent or not permitted becomes the default value.
 */
export const readParams = (
  definitions: ParamDefinition[],
  searchParams: PageSearchParams,
): QueryParam[] =>
  definitions.map((definition) => {
    const given = searchParams[definition.name];
    const value = Array.isArray(given) ? given[0] : given;

    return {
      ...definition,
      value:
        value !== undefined && definition.options.includes(value)
          ? value
          : definition.defaultValue,
    };
  });

/** Value of one parameter */
export const paramValue = (params: QueryParam[], name: string) =>
  params.find((param) => param.name === name)?.value ?? "";

/** Value of one true/false parameter */
export const paramFlag = (params: QueryParam[], name: string) =>
  paramValue(params, name) === "true";

/** Converts the values of `contentParams` to the options of the SDK */
export const contentOptions = (
  params: QueryParam[],
): ContentRenderingParams => ({
  contentType: paramValue(
    params,
    "content-type",
  ) as ContentRenderingParams["contentType"],
  includeNotes: paramFlag(params, "include-notes"),
  includeTitles: paramFlag(params, "include-titles"),
  includeChapterNumbers: paramFlag(params, "include-chapter-numbers"),
  includeVerseNumbers: paramFlag(params, "include-verse-numbers"),
  includeVerseSpans: paramFlag(params, "include-verse-spans"),
});

/**
 * Makes the query string for a link to a page of this application. It contains only
 * the values that are different from the defaults, so the URLs stay short.
 *
 * @param extra  Other values to put in the query string, for example `page`
 */
export const toQueryString = (
  params: QueryParam[],
  extra: Record<string, string> = {},
) => {
  const query = new URLSearchParams(extra);
  for (const { name, value, defaultValue } of params) {
    if (value !== defaultValue) {
      query.set(name, value);
    }
  }
  const text = query.toString();
  return text ? `?${text}` : "";
};
