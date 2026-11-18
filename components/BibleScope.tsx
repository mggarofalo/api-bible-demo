"use client";

import {
  BIBLE_SCOPE_COOKIE,
  BibleScope,
  parseBibleScope,
} from "@/utils/bibleScope";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

const SCOPE_EVENT = "bible-scope-change";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

const readScopeCookie = () =>
  parseBibleScope(
    document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${BIBLE_SCOPE_COOKIE}=`))
      ?.split("=")[1],
  );

/**
 * Reads and sets the Bible scope (see utils/bibleScope.ts). All components that use
 * this hook change together.
 */
export const useBibleScope = () => {
  const scope = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(SCOPE_EVENT, onChange);
      return () => window.removeEventListener(SCOPE_EVENT, onChange);
    },
    readScopeCookie,
    //The server components that need the scope read the cookie themselves
    (): BibleScope => "selected",
  );

  const setScope = (next: BibleScope) => {
    document.cookie = `${BIBLE_SCOPE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
    window.dispatchEvent(new Event(SCOPE_EVENT));
  };

  return [scope, setScope] as const;
};

type BibleScopeSwitchProps = {
  /** Scope that the server used for the page, so the switch is correct before the browser reads the cookie */
  initialScope?: BibleScope;
  className?: string;
};

/**
 * Switch between the short list of Bibles and all the Bibles that the API key can access.
 */
export const BibleScopeSwitch = ({
  initialScope,
  className = "",
}: BibleScopeSwitchProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cookieScope, setScope] = useBibleScope();
  //On the server and during the first render, the cookie is not available to this component
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const scope = mounted ? cookieScope : (initialScope ?? cookieScope);

  const onSelect = (next: BibleScope) => {
    if (next === scope) {
      return;
    }
    setScope(next);

    if (pathname === "/bibles") {
      //The scope sets the default of the `ids` parameter, so remove an `ids` value from the URL
      const query = new URLSearchParams(searchParams);
      query.delete("ids");
      const text = query.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    }
    //Get the server components again with the new scope
    router.refresh();
  };

  const options: { scope: BibleScope; label: string }[] = [
    { scope: "selected", label: "Selected" },
    { scope: "all", label: "All" },
  ];

  return (
    <div
      role="group"
      aria-label="Bibles in the lists"
      className={`inline-flex items-center border-line border-[1px] rounded overflow-hidden ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.scope}
          type="button"
          aria-pressed={scope === option.scope}
          //In a drop-down list, keep the focus in the filter box
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(option.scope)}
          className={`px-3 py-1 text-sm rounded-none cursor-pointer ${
            scope === option.scope
              ? "bg-accent text-white font-bold"
              : "bg-white hover:bg-accent-soft"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
