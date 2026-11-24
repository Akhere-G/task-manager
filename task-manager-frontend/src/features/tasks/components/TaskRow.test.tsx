import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useTaskContext } from "../../../context/TaskContext";
import { mockApi } from "../../../test/api";
import { makeGhost, makeTask, renderWithProviders } from "../../../test/render";
import type { Task } from "../types";
import TaskRow from "./TaskRow";

mockApi();

function PopupState() {
  const { popupMode, selectedTask } = useTaskContext();
  return (
    <p data-testid="popup">
      {popupMode}:{selectedTask?.title ?? "none"}:{String(selectedTask?.id)}
    </p>
  );
}

function renderRow(task: Task) {
  return renderWithProviders(
    <>
      <TaskRow task={task} />
      <PopupState />
    </>,
  );
}

describe("TaskRow", () => {
  it("opens edit and delete for the task", async () => {
    renderRow(makeTask({ id: 4, title: "Plan trip" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Edit task: Plan trip" }),
    );
    expect(screen.getByTestId("popup")).toHaveTextContent("Edit:Plan trip");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete task: Plan trip" }),
    );
    expect(screen.getByTestId("popup")).toHaveTextContent("Delete:Plan trip");
  });

  it("edits a repeating occurrence through its series", async () => {
    renderRow(makeGhost(5, "20260303", { title: "Water plants" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Edit task: Water plants" }),
    );

    expect(screen.getByTestId("popup")).toHaveTextContent(
      "Edit:Water plants:5",
    );
  });

  it("does not open the overview from the complete button", async () => {
    renderRow(makeTask({ title: "Plan trip" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Mark task as completed" }),
    );

    expect(screen.getByTestId("popup")).toHaveTextContent("Closed:none");
  });

  it("offers no start, break down or snooze for a finished task", () => {
    renderRow(makeTask({ title: "Plan trip", isCompleted: true }));

    expect(
      screen.queryByRole("button", { name: "Start task: Plan trip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Snooze task: Plan trip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark task as pending" }),
    ).toBeInTheDocument();
  });
});
