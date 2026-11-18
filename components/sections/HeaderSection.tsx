import { BibleBreadcrumbs, EndpointPath } from "../BibleBreadcrumbs";
import { BreadcrumbItem, Breadcrumbs } from "../Breadcrumbs";
import { Spacer } from "../Spacer";
import { LinkButton, LinkButtonProps } from "../LinkButton";
import { Bible } from "@americanbible/api-bible-sdk";

type HeaderProps = {
  bible?: Bible;
  title?: string;
  /** Shown on pages that are not part of a Bible. The pages of a Bible show lists as an alternative. */
  breadcrumbs?: BreadcrumbItem[];
  actionItems?: LinkButtonProps[];
};

/**
 * Renders a head consisting of the following:
 *   - Information about the currently selected Bible (name, ID, etc.)
 *   - Breadcrumbs
 *   - A page title & subtitle (if provided)
 */
export const HeaderSection = ({
  breadcrumbs = [],
  bible,
  title,
  actionItems = [],
}: HeaderProps) => {
  const items = actionItems;

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex items-stretch border-black border-b-[1px] sm:pr-4">
        <Spacer />
        <div className="flex flex-col px-4 py-12 grow">
          <BibleBreadcrumbs fallback={<Breadcrumbs items={breadcrumbs} />} />
          <div className="flex gap-2 items-center">
            {!!bible && (
              <div className="flex flex-col grow">
                <h3 className="text-2xl font-bold">{bible.name}</h3>
                <EndpointPath fallback={bible.id} />
              </div>
            )}
            {!!title && <h3 className="text-2xl font-bold">{title}</h3>}
          </div>
          {!!items.length && (
            <div className="mt-4 flex gap-2 flex-col sm:flex-row sm:items-center  sm:flex-wrap">
              {items.map((item) => (
                <LinkButton
                  key={item.href}
                  {...item}
                  className="border-[1px]"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
