import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../../../test/api";
import { makeTask, renderWithProviders } from "../../../test/render";
import type { TaskFilters } from "../../tasks/taskParams";
import type { Task } from "../../tasks/types";
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

const filters: TaskFilters = {
  search: "",
  project: "7",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "all",
  sortBy: "manual",
  order: "asc",
  currentDate: "",
};

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
  makeTask({ id: 15, title: "Loose end", projectId: 7, columnId: null }),
];

const PAGE_SIZE = 10;

/** Answers each column's request with its own page of `all`. */
function serveTasks(all: Task[]) {
  mock.onGet(/\/tasks/).reply((config) => {
    const params = new URL(config.url ?? "", "http://api").searchParams;
    const inColumn = all.filter((task) =>
      params.get("unassigned") === "true"
        ? task.columnId === null
        : String(task.columnId) === params.get("column"),
    );
    const page = Number(params.get("page"));
    return [
      200,
      {
        tasks: inColumn.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        totalTasks: inColumn.length,
        totalMinutes: inColumn.length * 60,
        totalPages: Math.ceil(inColumn.length / PAGE_SIZE),
        currentPage: page,
      },
    ];
  });
}

const board = (boardTasks: Task[] = tasks) => {
  mock.onGet("/projects/7/columns").reply(200, { columns });
  mock.onGet("/projects").reply(200, { projects: [] });
  mock.onGet("/labels").reply(200, { labels: [] });
  serveTasks(boardTasks);
  return renderWithProviders(
    <KanbanBoard projectId={7} filters={filters} search="" view="all" />,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const region = (name: string) => screen.findByRole("region", { name });

describe("KanbanBoard", () => {
  it("shows each task of the project in its column", async () => {
    board();

    expect(
      await within(await region("To Do")).findByText("Plan"),
    ).toBeVisible();
    expect(
      await within(await region("In Progress")).findByText("Build"),
    ).toBeVisible();
    expect(await within(await region("Done")).findByText("Ship")).toBeVisible();
  });

  it("asks for ten tasks per column, not the whole board", async () => {
    board();

    await region("To Do");
    await waitFor(() => expect(mock.history.get.length).toBeGreaterThan(3));
    const taskRequests = mock.history.get
      .filter((request) => request.url?.startsWith("/tasks"))
      .map((request) => new URL(request.url ?? "", "http://api").searchParams);
    expect(taskRequests).toHaveLength(4);
    taskRequests.forEach((params) => {
      expect(params.get("limit")).toBe("10");
      expect(params.get("project")).toBe("7");
    });
    expect(taskRequests.map((params) => params.get("column"))).toEqual(
      expect.arrayContaining(["1", "2", "3"]),
    );
    expect(
      taskRequests.some((params) => params.get("unassigned") === "true"),
    ).toBe(true);
  });

  it("totals a column and shows how many of its tasks are unloaded", async () => {
    board(
      Array.from({ length: 12 }, (_, index) =>
        makeTask({
          id: index + 1,
          title: `Card ${index + 1}`,
          projectId: 7,
          columnId: 1,
        }),
      ),
    );

    const todo = await region("To Do");
    expect(await within(todo).findByText("12 tasks · 12h")).toBeVisible();
    expect(within(todo).getByText("Showing 10 of 12")).toBeVisible();
    expect(within(todo).getByText("Scroll for 2 more ↓")).toBeVisible();
    expect(within(todo).queryByText("Card 11")).not.toBeInTheDocument();
  });

  it("loads the next ten when a column is scrolled to its end", async () => {
    const reveals: (() => void)[] = [];
    class FakeObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        reveals.push(() => callback([{ isIntersecting: true }]));
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    board(
      Array.from({ length: 12 }, (_, index) =>
        makeTask({
          id: index + 1,
          title: `Card ${index + 1}`,
          projectId: 7,
          columnId: 1,
        }),
      ),
    );
    const todo = await region("To Do");
    await within(todo).findByText("Card 10");

    reveals.forEach((reveal) => reveal());

    expect(await within(todo).findByText("Card 12")).toBeVisible();
    expect(within(todo).getByText("Showing 12 of 12")).toBeVisible();
  });

  it("shows tasks with no column in Unassigned, the first column", async () => {
    board();

    const unassigned = await region("Unassigned");
    expect(await within(unassigned).findByText("Loose end")).toBeVisible();
    const regions = screen.getAllByRole("region").map((r) => r.ariaLabel);
    expect(regions[0]).toBe("Unassigned");
  });

  it("adds a task to Unassigned without a column", async () => {
    mock.onPost("/tasks").reply(201, {});
    board();

    const unassigned = await region("Unassigned");
    await userEvent.click(
      within(unassigned).getByRole("button", { name: "Add task" }),
    );
    await userEvent.type(
      within(unassigned).getByLabelText("New task in Unassigned"),
      "Idea{Enter}",
    );

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      title: "Idea",
      columnId: null,
    });
  });

  it("can send a deleted column's tasks to Unassigned", async () => {
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
      "",
    );
    const [, confirm] = screen.getAllByRole("button", {
      name: "Delete column",
    });
    await userEvent.click(confirm);

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
    expect(JSON.parse(mock.history.delete[0].data)).toEqual({ moveToId: null });
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
