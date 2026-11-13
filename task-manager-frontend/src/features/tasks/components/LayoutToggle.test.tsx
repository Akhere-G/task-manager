import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LayoutToggle from "./LayoutToggle";

describe("LayoutToggle", () => {
  it("lets the board be chosen once a project is selected", async () => {
    const onSelect = vi.fn();
    render(<LayoutToggle layout="list" hasProject onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Board" }));

    expect(onSelect).toHaveBeenCalledWith("kanban");
  });

  it("hides the board without a project", () => {
    render(
      <LayoutToggle layout="list" hasProject={false} onSelect={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Board" }),
    ).not.toBeInTheDocument();
  });
});
