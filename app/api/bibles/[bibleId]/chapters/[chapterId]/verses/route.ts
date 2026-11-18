import { client } from "@/utils/api";

export type SidebarVerse = { id: string; number: string };

type RouteProps = {
  params: Promise<{ bibleId: string; chapterId: string }>;
};

const MAX_CACHED_CHAPTERS = 2000;
const requests = new Map<string, Promise<SidebarVerse[]>>();

/**
 * Lists the verses of a chapter for the sidebar, which loads them when a chapter is expanded.
 *
 * The sidebar runs in the browser, so it can't call API.Bible directly without exposing
 * the API key. This handler makes the call to the
 * `/bibles/{bibleId}/chapters/{chapterId}/verses` endpoint on the server instead, and
 * keeps each chapter's result in memory so expanding it again costs no API call.
 */
export async function GET(_request: Request, { params }: RouteProps) {
  const { bibleId, chapterId } = await params;
  const key = `${bibleId}/${chapterId}`;

  let request = requests.get(key);
  if (!request) {
    request = client.verses.list(bibleId, chapterId).then(({ data }) =>
      data.map((verse) => ({
        id: verse.id,
        //The part after the last dot, or the full ID when it has no dot
        number: verse.id.slice(verse.id.lastIndexOf(".") + 1),
      })),
    );
    if (requests.size >= MAX_CACHED_CHAPTERS) {
      requests.clear();
    }
    requests.set(key, request);
  }

  try {
    return Response.json(await request);
  } catch {
    requests.delete(key);
    return Response.json(
      { error: "Unable to list verses for this chapter." },
      { status: 502 },
    );
  }
}
