import type { MetadataRoute } from "next";

/**
 * Serves `/robots.txt`. Crawlers are welcome on the overview pages: the Bibles list,
 * each Bible, and its books and chapters. The pages below those are generated from
 * API calls for every verse, passage, section and search, so they're kept out of crawls.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      //A crawler uses the longest rule that matches a URL. The `$` stops these rules at the end
      //of the path. Without it, they are longer than "/*?" and let a URL with query parameters in.
      allow: ["/", "/bibles$", "/bibles/*/books$", "/bibles/*/books/*/chapters$"],
      disallow: [
        //A URL with query parameters is a different request to the API for each set of values
        "/*?",
        //The route that gives verse lists to the sidebar
        "/api/",
        "/bibles/*/verses/",
        "/bibles/*/passages/",
        "/bibles/*/sections/",
        "/bibles/*/search",
        "/bibles/*/chapters/*/verses",
        "/bibles/*/chapters/*/sections",
        "/bibles/*/books/*/sections",
      ],
    },
  };
}
