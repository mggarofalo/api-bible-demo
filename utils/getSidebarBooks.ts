import { client } from "./api";

export type SidebarChapter = { id: string; number: string };
export type SidebarBook = {
  id: string;
  name: string;
  chapters: SidebarChapter[];
};

const requests = new Map<string, Promise<SidebarBook[]>>();

/**
 * Returns every book and chapter of a Bible, trimmed down to what the sidebar needs.
 *
 * The sidebar is shown on every page of a Bible, so the list is fetched with a single
 * call to the `/bibles/{bibleId}/books?include-chapters=true` endpoint and kept in
 * memory for the life of the server. A failed request isn't kept, so the next render
 * tries again.
 */
export function getSidebarBooks(bibleId: string): Promise<SidebarBook[]> {
  let request = requests.get(bibleId);

  if (!request) {
    request = client.books
      .list(bibleId, { includeChapters: true })
      .then(({ data }) =>
        data.map((book) => ({
          id: book.id,
          name: book.name,
          chapters: (book.chapters ?? []).map((chapter) => ({
            id: chapter.id,
            number: String(chapter.number ?? chapter.id.split(".").pop()),
          })),
        })),
      )
      .catch((error) => {
        requests.delete(bibleId);
        throw error;
      });
    requests.set(bibleId, request);
  }

  return request;
}
