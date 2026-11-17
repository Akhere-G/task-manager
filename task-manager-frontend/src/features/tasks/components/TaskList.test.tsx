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
          sortable
        />
        <PopupState />
      </>,
    );

    screen.getByRole("button", { name: "Open task: Plan trip" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(screen.getByTestId("popup")).toHaveTextContent("View:Plan trip");
  });

  it("puts tasks under date headers and collapses a group", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    renderWithProviders(
      <TaskList
        groupByDate
        tasks={[
          makeTask({ id: 1, title: "Soon", startAt: soon, endAt: later }),
        ]}
      />,
    );

    const header = screen.getByRole("button", { name: /^Today/ });
    expect(screen.getByText("Soon")).toBeInTheDocument();

    await userEvent.click(header);

    expect(screen.queryByText("Soon")).not.toBeInTheDocument();
  });

  it("shows flat rows without headers when grouping is off", () => {
    renderWithProviders(
      <TaskList tasks={[makeTask({ id: 1, title: "Plain" })]} />,
    );

    expect(screen.getByText("Plain")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /tasks$/ }),
    ).not.toBeInTheDocument();
  });
});
