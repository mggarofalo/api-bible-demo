import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Combobox, ComboboxOption } from "@/components/Combobox";

//jsdom has no layout, so it has no scrollIntoView
const scrollIntoView = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});
beforeEach(() => {
  scrollIntoView.mockClear();
});

const options: ComboboxOption[] = [
  { id: "kjv", label: "King James Version", detail: "KJV · English" },
  { id: "asv", label: "American Standard Version", detail: "ASV · English" },
  { id: "rvr", label: "Reina Valera", detail: "RVR · Spanish" },
];

const setup = (props: Partial<Parameters<typeof Combobox>[0]> = {}) => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <div>
      <p>Outside</p>
      <Combobox
        label="Bible"
        value="asv"
        options={options}
        onSelect={onSelect}
        {...props}
      />
    </div>,
  );
  const openList = () =>
    user.click(screen.getByRole("button", { name: /^Bible:/ }));
  return { ...view, onSelect, user, openList };
};

const optionNames = () =>
  within(screen.getByRole("listbox")).queryAllByRole("option").map(
    (option) => option.querySelector("p")?.textContent,
  );

const activeOption = () => {
  const id = screen.getByRole("combobox").getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.querySelector("p")?.textContent : null;
};

describe("Combobox", () => {
  it("shows the selected option as a button when closed", () => {
    setup();
    const button = screen.getByRole("button", {
      name: "Bible: American Standard Version",
    });
    expect(button).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the selected text instead of the option label", () => {
    setup({ selectedText: "ASV" });
    expect(screen.getByRole("button", { name: "Bible: ASV" })).toHaveTextContent(
      "ASV",
    );
  });

  it("shows the label when no option is selected", () => {
    setup({ value: undefined });
    expect(screen.getByRole("button", { name: "Bible: Bible" })).toBeInTheDocument();
  });

  it("opens a focused filter box with all options", async () => {
    const { openList } = setup();
    await openList();

    const input = screen.getByRole("combobox", { name: "Bible" });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(input).toHaveValue("");
    expect(optionNames()).toEqual([
      "King James Version",
      "American Standard Version",
      "Reina Valera",
    ]);
  });

  it("highlights and marks the selected option when it opens", async () => {
    const { openList } = setup();
    await openList();

    expect(activeOption()).toBe("American Standard Version");
    const selected = screen.getByRole("option", { selected: true });
    expect(selected).toHaveTextContent("American Standard Version");
    expect(screen.getAllByRole("option", { selected: false })).toHaveLength(2);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("highlights the first option when no option is selected", async () => {
    const { openList } = setup({ value: "missing" });
    await openList();
    expect(activeOption()).toBe("King James Version");
  });

  it("filters by label, ID and detail without regard to case", async () => {
    const { openList, user } = setup();
    await openList();
    const input = screen.getByRole("combobox");

    await user.type(input, "SPANISH");
    expect(optionNames()).toEqual(["Reina Valera"]);

    await user.clear(input);
    await user.type(input, "kjv");
    expect(optionNames()).toEqual(["King James Version"]);

    await user.clear(input);
    await user.type(input, "  reina  ");
    expect(optionNames()).toEqual(["Reina Valera"]);
  });

  it("lists options that start with the filter text first", async () => {
    const { openList, user } = setup();
    await openList();
    //"a" is in all three labels. Only "American Standard Version" starts with it.
    await user.type(screen.getByRole("combobox"), "a");
    expect(optionNames()[0]).toBe("American Standard Version");
    expect(optionNames()).toHaveLength(3);
  });

  it("highlights the first match after the filter changes", async () => {
    const { openList, user } = setup();
    await openList();
    await user.type(screen.getByRole("combobox"), "version");
    expect(activeOption()).toBe("King James Version");
  });

  it("shows the empty text when no option matches", async () => {
    const { openList, user } = setup({ emptyText: "No Bible has this text." });
    await openList();
    const input = screen.getByRole("combobox");
    await user.type(input, "zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No Bible has this text.")).toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("shows the default empty text", async () => {
    const { openList, user } = setup();
    await openList();
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("moves the highlight with the arrow keys and wraps at the ends", async () => {
    const { openList, user } = setup({ value: "kjv" });
    await openList();
    expect(activeOption()).toBe("King James Version");

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe("American Standard Version");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeOption()).toBe("King James Version");
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe("Reina Valera");
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("keeps working when arrow keys are pushed with no matches", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    const input = screen.getByRole("combobox");
    await user.type(input, "zzz");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");

    //Enter with no match does nothing, and the list stays open
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    await user.clear(input);
    expect(activeOption()).toBe("King James Version");
  });

  it("selects the highlighted option with Enter and closes", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("rvr");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects a filtered option with Enter", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.type(screen.getByRole("combobox"), "king{Enter}");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("kjv");
  });

  it("closes without a call when the selected option is chosen again", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects an option with a click", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.click(screen.getByText("Reina Valera"));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("rvr");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("highlights an option when the pointer moves onto it", async () => {
    const { openList, user } = setup();
    await openList();
    await user.hover(screen.getByText("Reina Valera"));
    expect(activeOption()).toBe("Reina Valera");
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("closes with Escape and selects nothing", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Bible: American Standard Version" }),
    ).toBeInTheDocument();
  });

  it("closes on a click out of the list and selects nothing", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.click(screen.getByText("Outside"));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes when the focus leaves with Tab", async () => {
    const { openList, user, onSelect } = setup();
    await openList();
    await user.tab();

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clears the filter when it opens again", async () => {
    const { openList, user } = setup();
    await openList();
    await user.type(screen.getByRole("combobox"), "king");
    await user.keyboard("{Escape}");
    await openList();

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(optionNames()).toHaveLength(3);
  });

  it("runs the action and closes when the action is clicked", async () => {
    const action = { label: "Open the Bibles page", onSelect: vi.fn() };
    const { openList, user, onSelect } = setup({ action });
    await openList();
    await user.click(screen.getByText("Open the Bibles page"));

    expect(action.onSelect).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps the list open and the focus in the input on a header click", async () => {
    const onHeaderClick = vi.fn();
    const { openList, user } = setup({
      header: (
        <button type="button" onClick={onHeaderClick}>
          Switch
        </button>
      ),
    });
    await openList();
    await user.click(screen.getByText("Switch"));

    expect(onHeaderClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("keeps the focus in the input on a click on the header text", async () => {
    const { openList, user } = setup({ header: "Header text" });
    await openList();
    await user.click(screen.getByText("Header text"));
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("shows the detail line of each option", async () => {
    const { openList, user } = setup({
      options: [...options, { id: "none", label: "No detail" }],
    });
    await openList();
    expect(screen.getByText("KJV · English")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No detail" }).children).toHaveLength(1);

    //An option with no detail can still be found by its label
    await user.type(screen.getByRole("combobox"), "detail");
    expect(optionNames()).toEqual(["No detail"]);
  });
  it("filters by the ID of an option when the ID is not in its text", async () => {
    const { openList, user } = setup({
      options: [...options, { id: "x-7731", label: "Plain Label", detail: "Plain detail" }],
    });
    await openList();
    await user.type(screen.getByRole("combobox"), "7731");
    expect(optionNames()).toEqual(["Plain Label"]);
  });

  it("scrolls the newly highlighted option into view after an arrow key", async () => {
    const { openList, user } = setup({ value: "kjv" });
    await openList();
    scrollIntoView.mockClear();

    await user.keyboard("{ArrowDown}");

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    const target = scrollIntoView.mock.contexts[0] as HTMLElement;
    expect(target).toBe(screen.getByRole("option", { name: /American Standard/ }));
  });

  it("stops listening for clicks out of the list when it closes", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { openList, user } = setup();
    await openList();
    const added = add.mock.calls.filter(([type]) => type === "pointerdown");
    expect(added).toHaveLength(1);
    expect(remove).not.toHaveBeenCalledWith("pointerdown", added[0][1]);

    await user.keyboard("{Escape}");

    expect(remove).toHaveBeenCalledWith("pointerdown", added[0][1]);
    add.mockRestore();
    remove.mockRestore();
  });

  it("stops listening for clicks out of the list when it unmounts open", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { openList, unmount } = setup();
    await openList();
    const added = add.mock.calls.filter(([type]) => type === "pointerdown");
    expect(added).toHaveLength(1);

    unmount();

    expect(remove).toHaveBeenCalledWith("pointerdown", added[0][1]);
    add.mockRestore();
    remove.mockRestore();
  });

  it.each(["ArrowDown", "ArrowUp", "Enter", "Escape"])(
    "cancels the default action of %s while the list is open",
    async (key) => {
      const { openList } = setup();
      await openList();
      const notCancelled = fireEvent.keyDown(screen.getByRole("combobox"), { key });
      expect(notCancelled).toBe(false);
    },
  );

  it("does not cancel the default action of other keys", async () => {
    const { openList } = setup();
    await openList();
    expect(fireEvent.keyDown(screen.getByRole("combobox"), { key: "a" })).toBe(true);
  });

});
