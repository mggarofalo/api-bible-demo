"use client";

import { ArrowRight, ChevronsUpDown } from "lucide-react";
import {
  KeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type ComboboxOption = {
  id: string;
  label: string;
  /** Second line of text. The filter also looks at this text. */
  detail?: string;
};

type ComboboxProps = {
  /** Name of the list for screen readers, for example "Bible" */
  label: string;
  /** ID of the option that is selected now */
  value?: string;
  options: ComboboxOption[];
  onSelect: (id: string) => void;
  /** Text shown for the selected option when the list is closed. Default: the label of the option. */
  selectedText?: string;
  /** An item at the top of the list that is not an option, for example a link to a full page */
  action?: { label: string; onSelect: () => void };
  /** Controls shown on top of the list, for example a switch that changes the options */
  header?: ReactNode;
  /** Text shown in the list when no option agrees with the filter */
  emptyText?: string;
};

/**
 * Drop-down list with a text filter.
 *
 * Closed, it shows the selected option as text. Click the text to open the list. Then
 * type to filter the options, and select one with the mouse or with the arrow keys
 * and Enter.
 *
 * To close the list without a selection, push Escape or click out of the list.
 */
export const Combobox = ({
  label,
  value,
  options,
  onSelect,
  selectedText,
  action,
  header,
  emptyText = "No results.",
}: ComboboxProps) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const activeOption = useRef<HTMLLIElement>(null);

  const selected = options.find(({ id }) => id === value);
  const closedText = selectedText ?? selected?.label ?? label;
  const search = query.trim().toLowerCase();
  const matches = search
    ? options
        .filter(({ id, label, detail }) =>
          [id, label, detail ?? ""].some((text) =>
            text.toLowerCase().includes(search),
          ),
        )
        //Show the options that start with the filter text first
        .sort(
          (a, b) =>
            Number(b.label.toLowerCase().startsWith(search)) -
            Number(a.label.toLowerCase().startsWith(search)),
        )
    : options;

  //Keep the highlighted option in view when the user moves through the list
  useEffect(() => {
    activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  //Close the list when the user clicks out of it
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const show = () => {
    setQuery("");
    //Start at the selected option
    setActiveIndex(Math.max(0, options.findIndex(({ id }) => id === value)));
    setOpen(true);
  };

  const close = () => setOpen(false);

  const select = (option: ComboboxOption) => {
    close();
    if (option.id !== value) {
      onSelect(option.id);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) =>
        matches.length ? (index + step + matches.length) % matches.length : 0,
      );
    } else if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      select(matches[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`${label}: ${closedText}`}
        aria-haspopup="listbox"
        onClick={show}
        className="flex items-center gap-1 text-sm font-bold cursor-pointer border-b-[1px] border-dashed border-transparent hover:border-line"
      >
        {closedText}
        <ChevronsUpDown size={12} className="shrink-0 text-zinc-500" />
      </button>
    );
  }

  return (
    <div ref={container} className="relative w-64 max-w-[70vw]">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          matches[activeIndex]
            ? `${listId}-${matches[activeIndex].id}`
            : undefined
        }
        //The input appears when the list opens, so it takes the focus
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder="Type to filter"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        className="w-full px-2 py-1 text-sm font-bold bg-white border-line border-[1px] rounded-b-none outline-none"
      />

      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        className="absolute z-50 left-0 top-full w-full max-h-[50vh] overflow-y-auto bg-white border-line border-x-[1px] border-b-[1px] rounded-b shadow-lg"
      >
        {!!header && (
          <li
            role="presentation"
            //Keep the focus in the input. If not, the list closes before the click.
            onMouseDown={(event) => event.preventDefault()}
            className="flex items-center justify-between gap-2 px-2 py-2 text-xs text-zinc-500 border-line border-b-[1px]"
          >
            {header}
          </li>
        )}
        {!!action && (
          <li
            role="presentation"
            //Keep the focus in the input. If not, the list closes before the click.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              close();
              action.onSelect();
            }}
            className="sticky top-0 flex items-center justify-between gap-2 px-2 py-2 text-sm font-bold cursor-pointer bg-accent-soft border-accent border-b-[1px] hover:bg-accent hover:text-white"
          >
            {action.label}
            <ArrowRight size={14} className="shrink-0" />
          </li>
        )}
        {!matches.length && (
          <li className="px-2 py-2 text-xs text-zinc-500">{emptyText}</li>
        )}
        {matches.map((option, index) => (
          <li
            key={option.id}
            id={`${listId}-${option.id}`}
            ref={index === activeIndex ? activeOption : undefined}
            role="option"
            aria-selected={option.id === value}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => select(option)}
            className={`px-2 py-1.5 cursor-pointer border-zinc-200 border-b-[1px] ${
              index === activeIndex ? "bg-accent text-white" : ""
            }`}
          >
            <p className={`text-sm ${option.id === value ? "font-bold" : ""}`}>
              {option.label}
            </p>
            {!!option.detail && (
              <p
                className={`text-xs ${index === activeIndex ? "text-zinc-200" : "text-zinc-500"}`}
              >
                {option.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
