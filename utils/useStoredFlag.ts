"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "stored-flag-change";

/**
 * Keeps an on/off setting in the browser's local storage, so the setting stays the
 * same on the next page and on the next visit. All components that use the same key
 * get the same value.
 *
 * The server cannot read the browser's storage, so the value is `false` until the
 * page is active in the browser.
 */
export const useStoredFlag = (key: string) => {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(CHANGE_EVENT, onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(key) === "true";
      } catch {
        return false;
      }
    },
    () => false,
  );

  const setValue = (next: boolean) => {
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      //Storage is not available, so the setting cannot be kept
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [value, setValue] as const;
};
