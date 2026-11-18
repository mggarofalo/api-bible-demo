import type { ContentRenderingParams } from "@americanbible/api-bible-sdk";

/**
 * A query parameter of an API.Bible endpoint that the user can change on a page
 */
export type QueryParam = {
  /** Name of the query parameter in the API, for example `content-type` */
  name: string;
  /** Values that the user can select. An empty list means that the user types the value. */
  options: readonly string[];
  /** Example value, shown in the text box of a parameter that the user types */
  placeholder?: string;
  /**
   * `bibles`: the value is a list of Bible IDs with commas between them. The page shows
   * a list of Bibles to select from, as an alternative to a text box.
   */
  kind?: "bibles";
  /** One sentence that tells the user what the parameter does */
  description?: string;
  /** Value that the page uses when the page URL does not give one */
  defaultValue: string;
  /** Value in use now */
  value: string;
};

type ParamDefinition = Omit<QueryParam, "value">;

export type PageSearchParams = Record<string, string | string[] | undefined>;

const BOOLEAN = ["true", "false"] as const;
//Longest value that a typed parameter can have
const MAX_TEXT_LENGTH = 500;

/** A true/false parameter, shown as a checkbox */
export const flagParam = (
  name: string,
  defaultValue: "true" | "false",
): ParamDefinition => ({ name, options: BOOLEAN, defaultValue });

/** A parameter that the user types, shown as a text box */
export const textParam = (
  name: string,
  placeholder: string,
  defaultValue = "",
): ParamDefinition => ({ name, options: [], defaultValue, placeholder });

/**
 * Query parameters of the endpoints that give verse text (chapters, verses, passages
 * and sections). See the [Verse Content Guide](https://docs.api.bible/guides/verses#verse-content).
 *
 * The default values are the defaults of the API, so a page sends none of these
 * parameters until the user changes one.
 *
 * @param defaults  Default values that are different for a page
 * @param extra     Other parameters of the endpoint, shown before `parallels`
 */
export const contentParams = (
  defaults: Record<string, string> = {},
  extra: ParamDefinition[] = [],
): ParamDefinition[] =>
  [
    { name: "content-type", options: ["html", "json", "text"], defaultValue: "html" },
    { name: "include-notes", options: BOOLEAN, defaultValue: "false" },
    { name: "include-titles", options: BOOLEAN, defaultValue: "true" },
    { name: "include-chapter-numbers", options: BOOLEAN, defaultValue: "false" },
    { name: "include-verse-numbers", options: BOOLEAN, defaultValue: "true" },
    { name: "include-verse-spans", options: BOOLEAN, defaultValue: "false" },
    ...extra,
    {
      name: "parallels",
      options: [],
      defaultValue: "",
      kind: "bibles" as const,
      description:
        "Get the same content from other Bibles in the same request. The response has one more item for each Bible.",
    },
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

    if (!definition.options.length) {
      //A typed parameter can have any text
      return {
        ...definition,
        value: (value ?? definition.defaultValue)
          .trim()
          .slice(0, MAX_TEXT_LENGTH),
      };
    }

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

/** Value of one typed parameter. Returns `undefined` when it is empty, so the request omits it. */
export const paramText = (params: QueryParam[], name: string) =>
  paramValue(params, name) || undefined;

/** Values of one typed parameter that is a list with commas between the items */
export const paramList = (params: QueryParam[], name: string) => {
  const items = paramValue(params, name)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};

/**
 * `use-org-id` parameter of the verse and passage endpoints. When it is `true`, the API
 * finds verses by their `orgId` (the ID in the original versification), not by their `id`.
 *
 * The SDK does not have this parameter, so pages send it with `orgIdQuery`.
 */
export const USE_ORG_ID = flagParam("use-org-id", "false");

/** Gives the `use-org-id` value to `traced`, which adds it to the request */
export const orgIdQuery = (params: QueryParam[]): Record<string, string> =>
  paramFlag(params, "use-org-id") ? { "use-org-id": "true" } : {};

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
  parallels: paramList(params, "parallels"),
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
