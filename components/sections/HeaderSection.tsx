import { BibleBreadcrumbs, RouteHero } from "../BibleBreadcrumbs";
import { BreadcrumbItem, Breadcrumbs } from "../Breadcrumbs";
import { EndpointNav } from "../EndpointNav";
import { Spacer } from "../Spacer";
import { LinkButton, LinkButtonProps } from "../LinkButton";
import { Bible } from "@americanbible/api-bible-sdk";

type HeaderProps = {
  bible?: Bible;
  title?: string;
  /** Shows the API route as the main heading, with the title below it. Always on for the pages of a Bible. */
  route?: boolean;
  /** Shown on pages that are not part of a Bible. The pages of a Bible show lists as an alternative. */
  breadcrumbs?: BreadcrumbItem[];
  actionItems?: LinkButtonProps[];
};

/**
 * Renders a head consisting of the following:
 *   - Breadcrumbs
 *   - The route of the API endpoint that the page calls, as the main heading
 *   - The name of the currently selected Bible, or a page title
 *   - Links to each endpoint that applies to the current location
 *   - Buttons for related pages (if provided)
 */
export const HeaderSection = ({
  breadcrumbs = [],
  bible,
  title,
  route = !!bible,
  actionItems = [],
}: HeaderProps) => {
  const items = actionItems;

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex items-stretch border-line border-b-[1px] sm:pr-4">
        <Spacer />
        <div className="flex flex-col px-4 py-12 grow">
          <BibleBreadcrumbs fallback={<Breadcrumbs items={breadcrumbs} />} />
          {route && <RouteHero />}
          {!!bible && (
            <p className="mt-2 text-zinc-500">
              {bible.name} ({bible.abbreviation})
            </p>
          )}
          {!!title &&
            (route ? (
              <p className="mt-2 text-zinc-500">{title}</p>
            ) : (
              <h3 className="text-2xl font-bold">{title}</h3>
            ))}
          {/* Links to each endpoint for the current location. Shows on the pages of a Bible only. */}
          {!!bible && <EndpointNav />}
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
