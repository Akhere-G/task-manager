import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Popup from "./Popup";

describe("Popup", () => {
  it("is a modal dialog named by its title that holds focus", () => {
    render(
      <Popup title="Delete task" close={() => {}}>
        <p>Sure?</p>
      </Popup>,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete task" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });
});
