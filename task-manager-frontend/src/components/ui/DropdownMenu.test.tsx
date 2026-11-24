import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DropdownMenu from "./DropdownMenu";

function renderMenu(onPick = vi.fn()) {
  render(
    <DropdownMenu label="Group actions" trigger="..." triggerClassName="">
      {(close) => (
        <button
          role="menuitem"
          onClick={() => {
            close();
            onPick();
          }}
        >
          Pick
        </button>
      )}
    </DropdownMenu>,
  );
  return onPick;
}

describe("DropdownMenu", () => {
  it("closes on Escape and on an outside press", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Group actions" });

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
