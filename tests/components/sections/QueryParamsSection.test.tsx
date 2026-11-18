import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BibleNavProvider } from "@/components/BibleNav";
import { QueryParamsSection } from "@/components/sections/QueryParamsSection";
import { findEndpoint } from "@/utils/apiReference";
import {
  contentParams,
  flagParam,
  readParams,
  textParam,
} from "@/utils/queryParams";

const nav = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  pathname: "/",
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

const CHAPTER = "/bibles/bible1/chapters/GEN.1";
const SEARCH = "/bibles/bible1/search";

const bibles = [
  { id: "bible1", name: "First Bible", abbreviation: "FB", language: "English" },
  { id: "bible2", name: "Second Bible", abbreviation: "SB", language: "Spanish" },
  { id: "bible3", name: "Third Bible", abbreviation: "", language: "French" },
];

type Definitions = Parameters<typeof readParams>[0];

//Renders the section the way a page does: values come from the URL of the page
const renderSection = (
  pathname: string,
  search: string,
  definitions: Definitions,
) => {
  nav.pathname = pathname;
  nav.search = search;
  const values = Object.fromEntries(new URLSearchParams(search));
  const params = readParams(definitions, values);
  return render(
    <BibleNavProvider bibleId="bible1" bibles={bibles} books={[]}>
      <QueryParamsSection params={params} />
    </BibleNavProvider>,
  );
};

const lastUrl = () => nav.router.replace.mock.lastCall?.[0] as string;

describe("QueryParamsSection", () => {
  beforeEach(() => {
    nav.pathname = "/";
    nav.search = "";
    //Show all the Bibles in the list to add
    document.cookie = "bible-scope=all; path=/";
    //jsdom has no layout, so the list of Bibles needs this stub
    Element.prototype.scrollIntoView = vi.fn();
  });

  describe("controls", () => {
    it("shows the right control for each kind of parameter", () => {
      renderSection(CHAPTER, "", contentParams());

      expect(screen.getByRole("heading", { name: /Query Parameters/ })).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(5);
      expect(screen.getByRole("checkbox", { name: /^include-notes/ })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^include-titles/ })).toBeChecked();

      const list = screen.getByRole("combobox", { name: /^content-type/ });
      expect(
        within(list)
          .getAllByRole("option")
          .map((option) => option.getAttribute("value")),
      ).toEqual(["html", "json", "text"]);
      expect(list).toHaveValue("html");

      //The Bibles parameter has its own list, not a text box
      expect(screen.getByRole("button", { name: "Bible to add: Add a Bible" })).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows a text box for a typed parameter, with its placeholder and value", () => {
      renderSection(SEARCH, "query=love", [
        textParam("query", "e.g. love"),
        textParam("limit", "10", "10"),
      ]);

      const query = screen.getByRole("textbox", { name: /^query/ });
      expect(query).toHaveValue("love");
      expect(query).toHaveAttribute("placeholder", "e.g. love");
      expect(screen.getByRole("textbox", { name: /^limit/ })).toHaveValue("10");
    });

    it("shows an empty list value as (not set)", () => {
      renderSection(SEARCH, "", [
        { name: "fuzziness", options: ["", "AUTO", "1"], defaultValue: "" },
      ]);
      expect(screen.getByRole("option", { name: "(not set)" })).toBeInTheDocument();
    });

    it("does not treat a two-value list that is not true/false as a checkbox", () => {
      renderSection(SEARCH, "", [
        { name: "mode", options: ["true", "maybe"], defaultValue: "true" },
      ]);
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: /^mode/ })).toBeInTheDocument();
    });
  });

  describe("help tips", () => {
    it("shows the description from the API reference", () => {
      renderSection(CHAPTER, "", contentParams());

      const description =
        findEndpoint(CHAPTER)?.endpoint.parameters["content-type"]?.description;
      expect(description).toBeTruthy();
      const label = screen.getByRole("combobox", { name: /^content-type/ })
        .closest("label") as HTMLElement;
      const tip = within(label).getByRole("tooltip", { hidden: true });
      //The tip shows the Markdown of the description as text
      expect(tip.textContent?.length).toBeGreaterThan(20);
      expect(tip.textContent).toContain(
        (description as string).replace(/[`*_]/g, "").slice(0, 20),
      );
    });

    it("shows a plain name when the reference has no endpoint for the page", () => {
      renderSection("/unknown", "", [flagParam("include-notes", "false")]);
      expect(screen.queryByRole("tooltip", { hidden: true })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "include-notes" })).toBeInTheDocument();
    });
  });

  describe("changes", () => {
    it("puts a checked box in the URL", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "", contentParams());

      await user.click(screen.getByRole("checkbox", { name: /^include-notes/ }));

      expect(nav.router.replace).toHaveBeenCalledTimes(1);
      expect(nav.router.replace).toHaveBeenCalledWith(
        `${CHAPTER}?include-notes=true`,
        { scroll: false },
      );
    });

    it("puts a value that is not the default in the URL, for a box that starts checked", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "", contentParams());

      await user.click(screen.getByRole("checkbox", { name: /^include-titles/ }));

      expect(lastUrl()).toBe(`${CHAPTER}?include-titles=false`);
    });

    it("removes a parameter that goes back to its default", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "include-notes=true&content-type=json", contentParams());

      await user.click(screen.getByRole("checkbox", { name: /^include-notes/ }));

      expect(lastUrl()).toBe(`${CHAPTER}?content-type=json`);
    });

    it("uses the bare path when no parameter is left", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "include-notes=true", contentParams());

      await user.click(screen.getByRole("checkbox", { name: /^include-notes/ }));

      expect(lastUrl()).toBe(CHAPTER);
    });

    it("sets a value from a list", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "", contentParams());

      await user.selectOptions(
        screen.getByRole("combobox", { name: /^content-type/ }),
        "text",
      );

      expect(lastUrl()).toBe(`${CHAPTER}?content-type=text`);
    });

    it("removes a list value that goes back to the default", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "content-type=text", contentParams());

      await user.selectOptions(
        screen.getByRole("combobox", { name: /^content-type/ }),
        "html",
      );

      expect(lastUrl()).toBe(CHAPTER);
    });

    it("keeps the other values of the URL", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "content-type=json&other=1", contentParams());

      await user.click(screen.getByRole("checkbox", { name: /^include-notes/ }));

      const url = new URL(lastUrl(), "http://x");
      expect(url.pathname).toBe(CHAPTER);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        "content-type": "json",
        other: "1",
        "include-notes": "true",
      });
    });

    it("starts at the first result again when a parameter changes", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "query=love&offset=20", [
        textParam("query", "e.g. love"),
        textParam("offset", "0", "0"),
      ]);

      const query = screen.getByRole("textbox", { name: /^query/ });
      await user.clear(query);
      await user.type(query, "grace{Enter}");

      expect(lastUrl()).toBe(`${SEARCH}?query=grace`);
    });

    it("keeps the offset when the offset changes", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "query=love&offset=20", [
        textParam("query", "e.g. love"),
        textParam("offset", "0", "0"),
      ]);

      const offset = screen.getByRole("textbox", { name: /^offset/ });
      await user.clear(offset);
      await user.type(offset, "30{Enter}");

      const url = new URL(lastUrl(), "http://x");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        query: "love",
        offset: "30",
      });
    });

    it("applies typed text on Enter, trimmed", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "", [textParam("query", "e.g. love")]);

      await user.type(screen.getByRole("textbox"), "  faith hope  {Enter}");

      expect(lastUrl()).toBe(`${SEARCH}?query=faith+hope`);
    });

    it("applies typed text when the box loses the focus", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "", [textParam("query", "e.g. love")]);

      await user.type(screen.getByRole("textbox"), "grace");
      expect(nav.router.replace).not.toHaveBeenCalled();
      await user.tab();

      expect(lastUrl()).toBe(`${SEARCH}?query=grace`);
    });

    it("trims the text when the box loses the focus", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "", [textParam("query", "e.g. love")]);

      await user.type(screen.getByRole("textbox"), "  grace  ");
      await user.tab();

      expect(lastUrl()).toBe(`${SEARCH}?query=grace`);
    });

    it("shows a new value from the server, not the text that the user typed", async () => {
      const user = userEvent.setup();
      const definitions = [textParam("query", "e.g. love")];
      const view = renderSection(SEARCH, "query=love", definitions);
      await user.type(screen.getByRole("textbox"), " and more");
      expect(screen.getByRole("textbox")).toHaveValue("love and more");

      //The server sends a different value
      view.rerender(
        <BibleNavProvider bibleId="bible1" bibles={bibles} books={[]}>
          <QueryParamsSection params={readParams(definitions, { query: "faith" })} />
        </BibleNavProvider>,
      );

      expect(screen.getByRole("textbox")).toHaveValue("faith");
    });

    it("ignores other keys", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "", [textParam("query", "e.g. love")]);

      await user.type(screen.getByRole("textbox"), "grace");

      expect(nav.router.replace).not.toHaveBeenCalled();
    });

    it("makes no change when the text is the same as the value", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "query=love", [textParam("query", "e.g. love")]);

      const box = screen.getByRole("textbox");
      await user.click(box);
      await user.keyboard("{Enter}");
      await user.tab();

      expect(nav.router.replace).not.toHaveBeenCalled();
    });

    it("keeps a typed default value out of the URL", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "limit=25", [textParam("limit", "10", "10")]);

      const box = screen.getByRole("textbox");
      await user.clear(box);
      await user.type(box, "10{Enter}");

      expect(lastUrl()).toBe(SEARCH);
    });

    it("removes a parameter when the text is cleared", async () => {
      const user = userEvent.setup();
      renderSection(SEARCH, "query=love&limit=25", [
        textParam("query", "e.g. love"),
        textParam("limit", "10", "10"),
      ]);

      await user.clear(screen.getByRole("textbox", { name: /^query/ }));
      await user.keyboard("{Enter}");

      expect(lastUrl()).toBe(`${SEARCH}?limit=25`);
    });
  });

  describe("highlighting", () => {
    //A sent parameter has the description "Sent in the request", and its wrapper has `data-sent="true"`
    const SENT = "Sent in the request";
    const expectSent = (control: HTMLElement, sent: boolean) => {
      if (sent) {
        expect(control).toHaveAccessibleDescription(SENT);
      } else {
        expect(control).not.toHaveAccessibleDescription(SENT);
      }
      expect(control.closest("label")).toHaveAttribute("data-sent", String(sent));
    };
    const boxOf = (name: RegExp) => screen.getByRole("combobox", { name });

    it("marks a parameter that the request sends", () => {
      renderSection(CHAPTER, "content-type=json&include-notes=true", contentParams());

      expectSent(boxOf(/^content-type/), true);
      expectSent(screen.getByRole("checkbox", { name: /^include-notes/ }), true);
    });

    it("does not mark a parameter with the default value of the API", () => {
      renderSection(CHAPTER, "", contentParams());

      expectSent(boxOf(/^content-type/), false);
      //`include-titles` is true by default in the API
      expectSent(screen.getByRole("checkbox", { name: /^include-titles/ }), false);
    });

    it("marks a page default that differs from the default of the API", () => {
      renderSection(CHAPTER, "", contentParams({ "content-type": "json" }));

      expect(boxOf(/^content-type/)).toHaveValue("json");
      expectSent(boxOf(/^content-type/), true);
    });

    it("marks a typed parameter that has text, and not an empty one", () => {
      renderSection(SEARCH, "query=love", [
        textParam("query", "e.g. love"),
        textParam("range", "GEN"),
        textParam("limit", "10", "10"),
      ]);

      expectSent(screen.getByRole("textbox", { name: /^query/ }), true);
      expectSent(screen.getByRole("textbox", { name: /^range/ }), false);
      //The API default of `limit` is 10
      expectSent(screen.getByRole("textbox", { name: /^limit/ }), false);
    });

    it("does not add the description text to the name of a control", () => {
      renderSection(SEARCH, "query=love", [textParam("query", "e.g. love")]);

      expect(screen.getByRole("textbox", { name: /^query/ })).not.toHaveAccessibleName(
        new RegExp(SENT),
      );
    });
  });

  describe("Defaults link", () => {
    it("is disabled when all values are the defaults", () => {
      renderSection(CHAPTER, "", contentParams());
      expect(screen.getByRole("button", { name: "Defaults" })).toBeDisabled();
    });

    it("is enabled when a value is not the default", () => {
      renderSection(CHAPTER, "include-notes=true", contentParams());
      expect(screen.getByRole("button", { name: "Defaults" })).toBeEnabled();
    });

    it("removes the parameters of the page and keeps other values", async () => {
      const user = userEvent.setup();
      renderSection(
        CHAPTER,
        "content-type=json&include-notes=true&other=1",
        contentParams(),
      );

      await user.click(screen.getByRole("button", { name: "Defaults" }));

      expect(nav.router.replace).toHaveBeenCalledTimes(1);
      expect(nav.router.replace).toHaveBeenCalledWith(`${CHAPTER}?other=1`, {
        scroll: false,
      });
    });

    it("goes to the bare path when nothing else is in the URL", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "content-type=json", contentParams());

      await user.click(screen.getByRole("button", { name: "Defaults" }));

      expect(lastUrl()).toBe(CHAPTER);
    });
  });

  describe("list of Bibles", () => {
    const params = () => contentParams();

    it("shows each selected Bible and the one to add", () => {
      renderSection(CHAPTER, "parallels=bible2,bible3,bible9", params());

      //Abbreviation, then the name when there is none, then the ID when the Bible is unknown
      expect(screen.getByTitle("bible2")).toHaveTextContent("SB");
      expect(screen.getByTitle("bible3")).toHaveTextContent("Third Bible");
      expect(screen.getByTitle("bible9")).toHaveTextContent("bible9");
      expect(screen.getByRole("button", { name: "Remove Second Bible" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove bible9" })).toBeInTheDocument();
    });

    it("removes a Bible from the list", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "parallels=bible2,bible3", params());

      await user.click(screen.getByRole("button", { name: "Remove Second Bible" }));

      expect(lastUrl()).toBe(`${CHAPTER}?parallels=bible3`);
    });

    it("removes the parameter when the last Bible goes", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "parallels=bible2", params());

      await user.click(screen.getByRole("button", { name: "Remove Second Bible" }));

      expect(lastUrl()).toBe(CHAPTER);
    });

    it("adds a Bible that the user picks, and offers only Bibles that are not selected", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "parallels=bible2", params());

      await user.click(screen.getByRole("button", { name: "Bible to add: Add a Bible" }));
      const options = within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent);
      expect(options).toHaveLength(2);
      expect(options.join(" ")).not.toContain("Second Bible");

      await user.click(screen.getByRole("option", { name: /Third Bible/ }));

      expect(new URL(lastUrl(), "http://x").searchParams.get("parallels")).toBe(
        "bible2,bible3",
      );
    });

    it("starts the list when the first Bible is added", async () => {
      const user = userEvent.setup();
      renderSection(CHAPTER, "", params());

      await user.click(screen.getByRole("button", { name: "Bible to add: Add a Bible" }));
      await user.click(screen.getByRole("option", { name: /First Bible/ }));

      expect(lastUrl()).toBe(`${CHAPTER}?parallels=bible1`);
    });

    it("shows the description of the parameter from the API reference", () => {
      renderSection(CHAPTER, "", params());
      const description =
        findEndpoint(CHAPTER)?.endpoint.parameters.parallels?.description;
      expect(description).toBeTruthy();
      expect(screen.getByText("parallels")).toBeInTheDocument();
      expect(
        document.body.textContent?.replace(/\s+/g, " "),
      ).toContain(
        (description as string).replace(/[`*_]/g, "").slice(0, 25).replace(/\s+/g, " "),
      );
    });
  });
});
