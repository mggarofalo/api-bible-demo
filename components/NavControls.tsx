"use client";

import { useStoredFlag } from "@/utils/useStoredFlag";
import { CircleHelp, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

export const HELP_COLLAPSED_KEY = "help-collapsed";
const THEME_KEY = "theme";
const THEME_EVENT = "theme-change";

/**
 * Runs before the page shows, so the page does not start in the incorrect theme or
 * with a help block that the user closed. The root layout puts it in the `<head>`.
 *
 * Theme: the selection of the user if there is one, and if not, the setting of the system.
 */
export const INITIAL_SETTINGS_SCRIPT = `(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem("${THEME_KEY}");
    var dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
    root.dataset.colorMode = dark ? "dark" : "light";
    root.dataset.help = localStorage.getItem("${HELP_COLLAPSED_KEY}") === "true" ? "collapsed" : "shown";
  } catch (error) {}
})();`;

const useDarkTheme = () => {
  const dark = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(THEME_EVENT, onChange);
      return () => window.removeEventListener(THEME_EVENT, onChange);
    },
    () => document.documentElement.classList.contains("dark"),
    //The server does not know the theme. The script above sets it before the page shows.
    () => false,
  );

  const setDark = (next: boolean) => {
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    //The scripture styles read this attribute
    root.dataset.colorMode = next ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      //Storage is not available, so the selection cannot be kept
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return [dark, setDark] as const;
};

const buttonClass =
  "flex items-center justify-center w-9 h-9 border-line border-[1px] cursor-pointer hover:bg-accent-soft";

/**
 * Buttons in the nav bar for two settings that apply to all pages:
 *   - Help: shows or hides the help block of each page. The browser keeps the
 *     selection in the `help-collapsed` value.
 *   - Theme: changes between the light theme and the dark theme.
 */
export const NavControls = () => {
  const [helpCollapsed, setHelpCollapsed] = useStoredFlag(HELP_COLLAPSED_KEY);
  const [dark, setDark] = useDarkTheme();

  //The stylesheet hides the help blocks when this attribute is "collapsed" (see globals.css)
  useEffect(() => {
    document.documentElement.dataset.help = helpCollapsed
      ? "collapsed"
      : "shown";
  }, [helpCollapsed]);

  const helpLabel = helpCollapsed ? "Show the help" : "Hide the help";
  const themeLabel = dark ? "Use the light theme" : "Use the dark theme";

  return (
    <>
      <button
        type="button"
        aria-label={helpLabel}
        aria-pressed={!helpCollapsed}
        title={helpLabel}
        onClick={() => setHelpCollapsed(!helpCollapsed)}
        className={`${buttonClass} ${helpCollapsed ? "text-zinc-500" : "bg-accent-soft text-accent"}`}
      >
        <CircleHelp size={18} />
      </button>
      <button
        type="button"
        aria-label={themeLabel}
        title={themeLabel}
        onClick={() => setDark(!dark)}
        className={buttonClass}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </>
  );
};
