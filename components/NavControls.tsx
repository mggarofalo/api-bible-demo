"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

/** Name of the browser value that collapses the help cards of all pages (see InfoSection) */
export const HELP_COLLAPSED_KEY = "help-collapsed";
const THEME_KEY = "theme";
const THEME_EVENT = "theme-change";

/**
 * Runs before the page shows, so the page does not start in the incorrect theme or
 * with open help cards that the user collapsed. The root layout puts it in the `<head>`.
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

/**
 * Button in the nav bar that changes between the light theme and the dark theme
 */
export const NavControls = () => {
  const [dark, setDark] = useDarkTheme();
  const themeLabel = dark ? "Use the light theme" : "Use the dark theme";

  return (
    <button
      type="button"
      aria-label={themeLabel}
      title={themeLabel}
      onClick={() => setDark(!dark)}
      className="flex items-center justify-center w-9 h-9 border-line border-[1px] cursor-pointer hover:bg-accent-soft"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};
