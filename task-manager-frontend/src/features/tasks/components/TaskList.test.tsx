import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useTaskContext } from "../../../context/TaskContext";
import { mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import TaskList from "./TaskList";

mockApi();

function PopupState() {
  const { popupMode, selectedTask } = useTaskContext();
  return (
    <p data-testid="popup">
      {popupMode}:{selectedTask?.title ?? "none"}
    </p>
  );
}

describe("TaskList", () => {
  it("opens a task from its title with the keyboard when cards can be dragged", async () => {
    renderWithProviders(
      <>
        <TaskList
          tasks={[makeTask({ id: 1, title: "Plan trip" }), makeTask({ id: 2 })]}
          sortableQueryKey={["tasks", "list"]}
        />
        <PopupState />
      </>,
    );

    screen.getByRole("button", { name: "Open task: Plan trip" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(screen.getByTestId("popup")).toHaveTextContent("View:Plan trip");
  });

  it("shows plain rows when not sortable", () => {
    renderWithProviders(
      <TaskList tasks={[makeTask({ id: 1, title: "One" })]} />,
    );

    expect(
      screen.getByRole("button", { name: "Open task: One" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Drag to reorder")).not.toBeInTheDocument();
  });

  it("labels the list when rows can be dragged", () => {
    renderWithProviders(
      <TaskList
        tasks={[makeTask({ id: 1, title: "One" })]}
        sortableQueryKey={["tasks", "list"]}
      />,
    );

    expect(screen.getByLabelText("Drag to reorder")).toBeInTheDocument();
  });
});
