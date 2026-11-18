import { NextRequest, NextResponse } from "next/server";
import { isApiKeySet } from "@/utils/apiKey";

/**
 * Stops the requests that need the API.Bible API key when the key is not set. Next.js
 * runs this function before it renders a page or runs a route handler, so the demo
 * makes no call to the API without a key.
 *
 *   - A page goes to the home page, which tells the user how to set the key
 *     (see components/ApiKeyNotice.tsx).
 *   - A route handler under `/api` returns an error as JSON.
 */
export function proxy(request: NextRequest) {
  if (isApiKeySet()) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error:
          "The API.Bible API key is not set. Set API_BIBLE_API_KEY in the .env file, then start the application again.",
      },
      { status: 503 },
    );
  }

  return NextResponse.redirect(new URL("/", request.url));
}

//All the paths that call the API. A new page or route under these paths gets the check.
export const config = {
  matcher: ["/bibles/:path*", "/api/bibles/:path*"],
};
