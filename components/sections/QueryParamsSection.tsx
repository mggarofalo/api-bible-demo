"use client";

import type { QueryParam } from "@/utils/queryParams";
import { ChevronDown, Loader } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Spacer } from "../Spacer";

//A parameter with only the values `true` and `false` shows as a checkbox
const isBoolean = ({ options }: QueryParam) =>
  options.length === 2 && options.includes("true") && options.includes("false");

type QueryParamsSectionProps = {
  params: QueryParam[];
};

/**
 * Shows the query parameters of the API request. A true/false parameter is a checkbox.
 * Other parameters have a list of values.
 *
 * When the user selects a value, the value goes into the URL of the page. The server
 * then sends the API request again with the new value, and the page shows the new
 * result. The page does not load again fully.
 */
export const QueryParamsSection = ({ params }: QueryParamsSectionProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onChange = (param: QueryParam, value: string) => {
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

  return (
    <div className="w-full flex items-stretch border-black border-b-[1px]">
      <Spacer />
      <div className="grow px-4 py-3">
        <h6 className="flex items-center gap-2 mb-2 text-sm font-bold">
          Query Parameters
          {pending && <Loader size={14} className="animate-spin" />}
        </h6>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {params.map((param) =>
            isBoolean(param) ? (
              <label
                key={param.name}
                className={`flex items-center gap-1.5 py-1 font-mono text-xs cursor-pointer ${
                  param.value === param.defaultValue
                    ? "text-zinc-600"
                    : "text-[#2563eb] font-bold"
                }`}
              >
                <input
                  type="checkbox"
                  checked={param.value === "true"}
                  onChange={(event) =>
                    onChange(param, String(event.target.checked))
                  }
                  className="w-4 h-4 accent-[#2563eb] cursor-pointer"
                />
                {param.name}
              </label>
            ) : (
            <label key={param.name} className="flex flex-col gap-0.5">
              <span className="font-mono text-xs text-zinc-500">
                {param.name}
              </span>
              <span className="relative">
                <select
                  value={param.value}
                  onChange={(event) => onChange(param, event.target.value)}
                  className={`appearance-none w-full pl-2 pr-7 py-1 text-sm font-bold bg-white border-[1px] cursor-pointer hover:bg-[#f1f7fe] ${
                    param.value === param.defaultValue
                      ? "border-black"
                      : "border-[#2563eb] text-[#2563eb]"
                  }`}
                >
                  {param.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
              </span>
            </label>
            ),
          )}
        </div>
      </div>
    </div>
  );
};
