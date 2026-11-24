import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ButtonGroup from "./ButtonGroup";

const options = [
  { name: "All", value: "" },
  { name: "Short", value: "short" },
];

describe("ButtonGroup", () => {
  it("marks the selected option as pressed", () => {
    render(
      <ButtonGroup
        label="Duration"
        value="short"
        options={options}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Short" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the chosen value", async () => {
    const onChange = vi.fn();
    render(
      <ButtonGroup
        label="Duration"
        value=""
        options={options}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Short" }));

    expect(onChange).toHaveBeenCalledWith("short");
  });
});
