import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useStoredFlag } from "@/utils/useStoredFlag";

const KEY = "test-flag";

//A small component that shows the flag and has a button to turn it over
const Toggle = ({ label, storageKey = KEY }: { label: string; storageKey?: string }) => {
  const [value, setValue] = useStoredFlag(storageKey);
  return (
    <button type="button" aria-pressed={value} onClick={() => setValue(!value)}>
      {label}
    </button>
  );
};

describe("useStoredFlag", () => {
  it("is false when storage has no value", () => {
    const { result } = renderHook(() => useStoredFlag(KEY));
    expect(result.current[0]).toBe(false);
  });

  it("reads a value that storage already has", () => {
    window.localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useStoredFlag(KEY));
    expect(result.current[0]).toBe(true);
  });

  it("is false for a stored value that is not true", () => {
    window.localStorage.setItem(KEY, "yes");
    const { result } = renderHook(() => useStoredFlag(KEY));
    expect(result.current[0]).toBe(false);
  });

  it("writes the value to storage and updates", () => {
    const { result } = renderHook(() => useStoredFlag(KEY));

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");

    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  it("keeps components with the same key in sync", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Toggle label="First" />
        <Toggle label="Second" />
        <Toggle label="Other" storageKey="other-flag" />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "First" }));

    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Other" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("updates when another tab changes storage", () => {
    const { result } = renderHook(() => useStoredFlag(KEY));
    act(() => {
      window.localStorage.setItem(KEY, "true");
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(result.current[0]).toBe(true);
  });

  it("is false when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useStoredFlag(KEY));
    expect(result.current[0]).toBe(false);
  });

  it("does not throw when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const listener = vi.fn();
    window.addEventListener("stored-flag-change", listener);
    const { result } = renderHook(() => useStoredFlag(KEY));

    expect(() => act(() => result.current[1](true))).not.toThrow();
    expect(result.current[0]).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("stored-flag-change", listener);
  });

  it("removes its listeners when the component unmounts", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useStoredFlag(KEY));
    unmount();
    const events = remove.mock.calls.map(([type]) => type);
    expect(events).toContain("storage");
    expect(events).toContain("stored-flag-change");
  });

  it("is false on the server even when storage is true", () => {
    window.localStorage.setItem(KEY, "true");
    const html = renderToString(<Toggle label="Server" />);
    expect(html).toContain('aria-pressed="false"');
  });
});
