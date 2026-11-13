import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import type { ProjectColumn } from "../types";
import KanbanBoard from "./KanbanBoard";

const mock = mockApi();

const column = (
  id: number,
  name: string,
  overrides: Partial<ProjectColumn> = {},
): ProjectColumn => ({
  id,
  projectId: 7,
  name,
  status: name.toLowerCase(),
  colour: "#64748b",
  onDrop: "nothing",
  position: id,
  ...overrides,
});

const columns = [
  column(1, "To Do"),
  column(2, "In Progress"),
  column(3, "Done", { onDrop: "complete" }),
];

const tasks = [
  makeTask({ id: 11, title: "Plan", projectId: 7, columnId: 1 }),
  makeTask({ id: 12, title: "Build", projectId: 7, columnId: 2 }),
  makeTask({
    id: 13,
    title: "Ship",
    projectId: 7,
    columnId: 3,
    isCompleted: true,
  }),
  makeTask({ id: 14, title: "Elsewhere", projectId: 8, columnId: null }),
];

const board = () => {
  mock.onGet("/projects/7/columns").reply(200, { columns });
  mock.onGet("/projects").reply(200, { projects: [] });
  mock.onGet("/labels").reply(200, { labels: [] });
  return renderWithProviders(<KanbanBoard projectId={7} tasks={tasks} />);
};

const region = (name: string) => screen.findByRole("region", { name });

describe("KanbanBoard", () => {
  it("shows each task of the project in its column", async () => {
    board();

    expect(within(await region("To Do")).getByText("Plan")).toBeVisible();
    expect(
      within(await region("In Progress")).getByText("Build"),
    ).toBeVisible();
    expect(within(await region("Done")).getByText("Ship")).toBeVisible();
    expect(screen.queryByText("Elsewhere")).not.toBeInTheDocument();
  });

  it("changes what a column does on drop from its settings", async () => {
    mock.onPatch("/columns/2").reply(200, columns[1]);
    board();

    const progress = await region("In Progress");
    await userEvent.click(
      within(progress).getByRole("button", {
        name: "Settings for In Progress",
      }),
    );
    await userEvent.selectOptions(
      within(progress).getByLabelText("When a task is dropped here"),
      "delete",
    );

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({
      onDrop: "delete",
    });
  });

  it("adds a task straight into a column", async () => {
    mock.onPost("/tasks").reply(201, {});
    board();

    const todo = await region("To Do");
    await userEvent.click(
      within(todo).getByRole("button", { name: "Add task" }),
    );
    await userEvent.type(
      within(todo).getByLabelText("New task in To Do"),
      "Write docs{Enter}",
    );

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      title: "Write docs",
      projectId: 7,
      columnId: 1,
    });
  });

  it("asks where to move the tasks before deleting a column", async () => {
    mock.onDelete("/columns/1").reply(200, {});
    board();

    const todo = await region("To Do");
    await userEvent.click(
      within(todo).getByRole("button", { name: "Settings for To Do" }),
    );
    await userEvent.click(
      within(todo).getByRole("button", { name: "Delete column" }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Move its tasks to"),
      "3",
    );
    const [, confirm] = screen.getAllByRole("button", {
      name: "Delete column",
    });
    await userEvent.click(confirm);

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
    expect(JSON.parse(mock.history.delete[0].data)).toEqual({ moveToId: 3 });
  });

  it("adds a column", async () => {
    mock.onPost("/projects/7/columns").reply(201, column(4, "Review"));
    board();

    await userEvent.type(
      await screen.findByLabelText("New column name"),
      "Review",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Review" });
  });
});
