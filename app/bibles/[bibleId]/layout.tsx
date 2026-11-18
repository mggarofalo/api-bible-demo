import { BibleNavProvider } from "@/components/BibleNav";
import { BibleSidebar } from "@/components/BibleSidebar";
import { getBibles } from "@/utils/getDemoBible";
import { getSidebarBooks } from "@/utils/getSidebarBooks";
import { ReactNode } from "react";

type BibleLayoutProps = {
  params: Promise<{ bibleId: string }>;
  children: ReactNode;
};

/**
 * Layout for all pages of one Bible. Adds the sidebar, and supplies the Bibles, books
 * and chapters that the sidebar and the header lists show.
 *
 * In the live demo, this layout also stops access to Bibles that are not in
 * demoBibles.ts. That check was removed here, so all Bibles that the API key can
 * access are available.
 */
export default async function BibleLayout({
  params,
  children,
}: BibleLayoutProps) {
  const { bibleId } = await params;

  //If this data is not available, show the page without the sidebar. The page reports the problem.
  const [books, bibles] = await Promise.all([
    getSidebarBooks(bibleId),
    getBibles(),
  ]).catch(() => [null, null]);

  if (!books || !bibles) {
    return <>{children}</>;
  }

  return (
    <BibleNavProvider
      key={bibleId}
      bibleId={bibleId}
      books={books}
      //Keep only the data that the Bible list shows
      bibles={bibles.map((bible) => ({
        id: bible.id,
        name: bible.name,
        abbreviation: bible.abbreviation ?? "",
        language: bible.language?.name ?? "",
      }))}
    >
      <BibleSidebar />
      {children}
    </BibleNavProvider>
  );
}
