"use client";

import { getApiDefaults } from "@/utils/apiDefaults";
import type { QueryParam } from "@/utils/queryParams";
import { ChevronDown, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useScopedBibles } from "../BibleNav";
import { Combobox } from "../Combobox";
import { Spacer } from "../Spacer";
import { X } from "lucide-react";

//A parameter with only the values `true` and `false` shows as a checkbox
const isBoolean = ({ options }: QueryParam) =>
  options.length === 2 && options.includes("true") && options.includes("false");

type QueryParamsSectionProps = {
  params: QueryParam[];
};

/**
 * Shows the query parameters of the API request:
 *   - A true/false parameter is a checkbox.
 *   - A parameter with a fixed set of values is a list.
 *   - A parameter that is a list of Bibles shows the selected Bibles, and a list to add one.
 *   - Other parameters are text boxes. Push Enter, or go out of the box, to apply the text.
 *
 * A control is blue when its parameter is in the API request, that is, when its value
 * is not the default of the API. The "Defaults" link sets all the parameters to their
 * default values.
 *
 * When the user changes a value, the value goes into the URL of the page. The server
 * then sends the API request again with the new value, and the page shows the new
 * result. The page does not load again fully.
 */
export const QueryParamsSection = ({ params }: QueryParamsSectionProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const bibles = useScopedBibles();

  const onChange = (param: QueryParam, value: string) => {
    if (value === param.value) {
      return;
    }
    const query = new URLSearchParams(searchParams);
    //Keep default values out of the URL
    if (value === param.defaultValue) {
      query.delete(param.name);
    } else {
      query.set(param.name, value);
    }
    //A different request has different results, so start at the first page of results
    query.delete("page");

    const text = query.toString();
    startTransition(() => {
      router.replace(text ? `${pathname}?${text}` : pathname, {
        scroll: false,
      });
    });
  };

  //The "Defaults" link sets all the parameters of the page to their default values
  const canReset = params.some((param) => param.value !== param.defaultValue);
  const onReset = () => {
    const query = new URLSearchParams(searchParams);
    for (const { name } of params) {
      query.delete(name);
    }
    query.delete("page");

    const text = query.toString();
    startTransition(() => {
      router.replace(text ? `${pathname}?${text}` : pathname, {
        scroll: false,
      });
    });
  };

  //A control is blue when its parameter is in the API request. The request does not
  //contain a parameter that is empty, or that has the default value of the API.
  const apiDefaults = getApiDefaults(pathname);
  const changed = (param: QueryParam) =>
    param.value !== "" && param.value !== apiDefaults[param.name];
  const boxClass = (param: QueryParam) =>
    `text-sm font-bold bg-white border-[1px] ${
      changed(param) ? "border-accent text-accent" : "border-line"
    }`;

  return (
    <div className="w-full flex items-stretch border-line border-b-[1px]">
      <Spacer />
      <div className="grow min-w-0 px-4 py-3">
        <h6 className="flex items-center gap-2 mb-2 text-sm font-bold">
          Query Parameters
          <button
            type="button"
            disabled={!canReset}
            onClick={onReset}
            className="font-normal underline cursor-pointer text-accent disabled:no-underline disabled:cursor-default disabled:text-zinc-400"
          >
            Defaults
          </button>
          {pending && <Loader size={14} className="animate-spin" />}
        </h6>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {params.map((param) => {
            if (isBoolean(param)) {
              return (
                <label
                  key={param.name}
                  className={`flex items-center gap-1.5 py-1 font-mono text-xs cursor-pointer ${
                    changed(param) ? "text-accent font-bold" : "text-zinc-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={param.value === "true"}
                    onChange={(event) =>
                      onChange(param, String(event.target.checked))
                    }
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                  {param.name}
                </label>
              );
            }

            if (param.kind === "bibles") {
              const selected = param.value.split(",").filter(Boolean);
              const setSelected = (ids: string[]) =>
                onChange(param, ids.join(","));

              return (
                <div
                  key={param.name}
                  className="basis-full flex flex-col gap-1 pt-2 mt-1 border-zinc-200 border-t-[1px]"
                >
                  <p className="font-mono text-xs text-zinc-500">
                    {param.name}
                  </p>
                  {!!param.description && (
                    <p className="text-sm">{param.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.map((id) => {
                      const bible = bibles.find((item) => item.id === id);
                      return (
                        <span
                          key={id}
                          title={id}
                          className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-sm font-bold text-accent bg-accent-soft border-accent/40 border-[1px]"
                        >
                          {bible ? bible.abbreviation || bible.name : id}
                          <button
                            type="button"
                            aria-label={`Remove ${bible?.name ?? id}`}
                            onClick={() =>
                              setSelected(selected.filter((item) => item !== id))
                            }
                            className="p-0.5 cursor-pointer hover:bg-accent hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    <Combobox
                      label="Bible to add"
                      selectedText="Add a Bible"
                      options={bibles
                        .filter(({ id }) => !selected.includes(id))
                        .map((bible) => ({
                          id: bible.id,
                          label: bible.name,
                          detail: `${bible.abbreviation} · ${bible.language}`,
                        }))}
                      onSelect={(id) => setSelected([...selected, id])}
                      emptyText="No Bible has this text."
                    />
                  </div>
                </div>
              );
            }

            return (
              <label key={param.name} className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-zinc-500">
                  {param.name}
                </span>
                {param.options.length ? (
                  <span className="relative">
                    <select
                      value={param.value}
                      onChange={(event) => onChange(param, event.target.value)}
                      className={`appearance-none w-full pl-2 pr-7 py-1 cursor-pointer hover:bg-accent-soft ${boxClass(param)}`}
                    >
                      {param.options.map((option) => (
                        <option key={option} value={option}>
                          {option || "(not set)"}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                    />
                  </span>
                ) : (
                  <input
                    type="text"
                    //A new value from the server replaces the text that the user typed
                    key={param.value}
                    defaultValue={param.value}
                    placeholder={param.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    onBlur={(event) => onChange(param, event.target.value.trim())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onChange(param, event.currentTarget.value.trim());
                      }
                    }}
                    className={`w-40 px-2 py-1 outline-none placeholder:font-normal placeholder:text-zinc-400 focus:border-accent ${boxClass(param)}`}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};
