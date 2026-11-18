"use client";

export const RAW_JSON_ID = "raw-json";

/**
 * Link from the response details to the raw JSON section, which holds the response body.
 * Expands that section before scrolling to it.
 */
export const JsonBodyLink = () => {
  return (
    <a
      href={`#${RAW_JSON_ID}`}
      className="underline"
      onClick={() => {
        const section = document.getElementById(RAW_JSON_ID);
        if (section instanceof HTMLDetailsElement) {
          section.open = true;
        }
      }}
    >
      Raw JSON Output
    </a>
  );
};
