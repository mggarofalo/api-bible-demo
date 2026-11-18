import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { Spacer } from "../Spacer";

type ExpandableSectionProps = {
  title: string;
  /** Short detail shown beside the title, visible even while collapsed */
  summary?: ReactNode;
  id?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * A titled section that expands and collapses when its title is clicked
 */
export const ExpandableSection = ({
  title,
  summary,
  id,
  defaultOpen = false,
  children,
}: ExpandableSectionProps) => {
  return (
    <details id={id} className="group w-full" open={defaultOpen}>
      <summary className="min-h-9 w-full flex items-stretch cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-line border-b-[1px] hover:bg-zinc-50">
        <Spacer />
        <p className="flex items-center gap-1 font-bold text-sm px-4 py-2 shrink-0">
          <ChevronRight
            size={16}
            className="transition-transform group-open:rotate-90"
          />
          {title}
        </p>
        {!!summary && (
          <div className="flex items-center min-w-0 pr-4 text-sm text-zinc-500">
            {summary}
          </div>
        )}
      </summary>
      <div className="p-4 bg-zinc-50 border-line border-b-[1px] max-h-[70vh] overflow-auto">
        {children}
      </div>
    </details>
  );
};
