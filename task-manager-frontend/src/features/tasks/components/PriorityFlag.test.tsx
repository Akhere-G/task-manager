import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeTask, renderWithProviders } from "../../../test/render";
import { TaskCardSmall } from "./TaskCardSmall";

function renderCard(priority: 1 | 2 | 3 | 4) {
  renderWithProviders(
    <TaskCardSmall
      {...makeTask({ priority })}
      setSelectedTask={vi.fn()}
      setIsCompleted={vi.fn()}
    />,
  );
}

describe("priority flag", () => {
  it.each([1, 2, 3] as const)("marks a P%i task", (priority) => {
    renderCard(priority);

    expect(
      screen.getByRole("img", { name: `Priority ${priority}` }),
    ).toBeInTheDocument();
  });

  it("shows nothing for a P4 task", () => {
    renderCard(4);

    expect(
      screen.queryByRole("img", { name: /Priority/ }),
    ).not.toBeInTheDocument();
  });
});
