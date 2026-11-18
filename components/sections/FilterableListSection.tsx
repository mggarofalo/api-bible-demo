"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { ListItemProps } from "./ListSection/ListItem";
import { ListSection } from "./ListSection/ListSection";

type FilterableItem = ListItemProps & {
  /** Text that the filter looks at, for example the name and the ID of the item */
  filterText: string;
};

type FilterableListSectionProps = {
  title?: string;
  /** Name of the filter box for screen readers, and its placeholder text */
  filterLabel: string;
  items: FilterableItem[];
};

/**
 * A `ListSection` with a text box. The list shows only the items that contain all the
 * words in the text box.
 */
export const FilterableListSection = ({
  title,
  filterLabel,
  items,
}: FilterableListSectionProps) => {
  const [query, setQuery] = useState("");

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? items.filter(({ filterText }) => {
        const text = filterText.toLowerCase();
        return words.every((word) => text.includes(word));
      })
    : items;

  return (
    <>
      <div className="flex items-center gap-2 px-4 sm:px-12 pt-4">
        <label className="grow flex items-center gap-2 px-3 py-2 rounded border-line border-[1px] focus-within:border-accent">
          <Search size={16} className="shrink-0 text-zinc-500" />
          <input
            type="search"
            aria-label={filterLabel}
            placeholder={filterLabel}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="grow min-w-0 outline-none bg-transparent"
          />
        </label>
      </div>
      <ListSection title={title} items={matches} />
    </>
  );
};
