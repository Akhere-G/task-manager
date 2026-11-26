import { QueryObserver, type QueryKey } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeGhost, makeQueryClient, makeTask } from "../../../test/render";
import type { GetTaskResult } from "../api";
import { categoryTasksKey } from "../hooks/useCategoryTasks";
import { getDefaultFilters, type TaskFilters } from "../taskParams";
import type { Task } from "../types";
import { predictUpdate } from "./predictions";
import { patchSubtask, patchTask } from "./taskCache";

const NOW = new Date("2026-03-02T12:00:00Z");

let queryClient = makeQueryClient();

beforeEach(() => {
  vi.setSystemTime(NOW);
  queryClient = makeQueryClient();
});

afterEach(() => {
  vi.useRealTimers();
});

function show<T>(queryKey: QueryKey, data: T) {
  queryClient.setQueryData(queryKey, data);
  new QueryObserver(queryClient, {
    queryKey,
    queryFn: () => data,
    staleTime: Infinity,
  }).subscribe(() => {});
}

const page = (tasks: Task[], totalTasks = tasks.length): GetTaskResult => ({
  tasks,
  totalTasks,
  totalMinutes: totalTasks * 60,
  totalPages: 1,
  currentPage: 1,
});

const filters = (overrides: Partial<TaskFilters> = {}): TaskFilters => ({
  ...getDefaultFilters(),
  isCompleted: "",
  ...overrides,
});

function showGroup(
  group: string,
  tasks: Task[],
  overrides: Partial<TaskFilters> = {},
) {
  const queryKey = categoryTasksKey({
    filters: filters(overrides),
    search: "",
    view: "all",
    params: { group },
  });
  show(queryKey, { pages: [page(tasks)], pageParams: [1] });
  return () => {
    const [latest] =
      queryClient.getQueryData<{ pages: GetTaskResult[] }>(queryKey)?.pages ??
      [];
    return {
      ids: latest.tasks.map((task) => task.id),
      total: latest.totalTasks,
      minutes: latest.totalMinutes,
    };
  };
}

function showOverview(
  layout: string,
  tasks: Task[],
  overrides: Partial<TaskFilters> = {},
  totalTasks = tasks.length,
) {
  const queryKey = [
    "tasks",
    { ...filters(overrides), search: "", view: "all", layout },
  ];
  show(queryKey, page(tasks, totalTasks));
  return () => queryClient.getQueryData<GetTaskResult>(queryKey);
}

const today = (id: number, overrides: Partial<Task> = {}) =>
  makeTask({
    id,
    startAt: "2026-03-02T14:00:00Z",
    endAt: "2026-03-02T15:00:00Z",
    ...overrides,
  });

const complete = predictUpdate({ isCompleted: true });

describe("applying a change to the cached task lists", () => {
  it("moves a task between groups and keeps their totals right", () => {
    const todayGroup = showGroup("today", [today(1), today(2)]);
    const completedGroup = showGroup(
      "completed",
      [
        today(3, { isCompleted: true, startAt: "2026-03-02T16:00:00Z" }),
        today(4, { isCompleted: true, startAt: "2026-03-02T08:00:00Z" }),
      ],
      { order: "desc" },
    );
    const header = showOverview("list", [today(2)], {}, 4);
    const matrix = showOverview(
      "matrix",
      [today(2)],
      { isCompleted: "false" },
      5,
    );

    patchTask(queryClient, { taskId: 1, change: complete });

    expect(todayGroup()).toEqual({ ids: [2], total: 1, minutes: 60 });
    expect(completedGroup()).toEqual({
      ids: [3, 1, 4],
      total: 3,
      minutes: 180,
    });
    expect(header()?.totalTasks).toBe(4);
    expect(matrix()?.totalTasks).toBe(4);
  });

  it("places a task only in lists whose project, label and priority it matches", () => {
    queryClient.setQueryData(
      ["projects"],
      [
        { id: 1, parentId: null },
        { id: 2, parentId: 1 },
      ],
    );
    const parentProject = showGroup("completed", [], { project: "1" });
    const otherProject = showGroup("completed", [], { project: "9" });
    const otherLabel = showGroup("completed", [], { label: "4" });
    const otherPriority = showGroup("completed", [], { priority: "1,2" });
    showGroup("today", [today(1, { projectId: 2, labelIds: [3] })]);

    patchTask(queryClient, { taskId: 1, change: complete });

    expect(parentProject().ids).toEqual([1]);
    expect(otherProject().ids).toEqual([]);
    expect(otherLabel().ids).toEqual([]);
    expect(otherPriority().ids).toEqual([]);
  });

  it("removes a deleted task and its series' ghosts", () => {
    const head = today(1, { isRepeating: true });
    const calendar = showOverview(
      "calendar",
      [head, makeGhost(1, "20260303"), today(2)],
      { currentDate: NOW.toISOString() },
    );
    queryClient.setQueryData(["tasks", "calendar"], []);

    patchTask(queryClient, { taskId: 1, change: () => null });

    expect(calendar()?.tasks.map((task) => task.id)).toEqual([2]);
  });

  it("copies an edit onto the task's ghosts and the open task", () => {
    const calendar = showOverview(
      "calendar",
      [today(1, { isRepeating: true }), makeGhost(1, "20260303")],
      { currentDate: NOW.toISOString() },
    );
    queryClient.setQueryData(["tasks", { id: 1 }], today(1));

    patchTask(queryClient, {
      taskId: 1,
      change: predictUpdate({ title: "Renamed" }),
    });

    expect(calendar()?.tasks.map((task) => task.title)).toEqual([
      "Renamed",
      "Renamed",
    ]);
    expect(queryClient.getQueryData<Task>(["tasks", { id: 1 }])?.title).toBe(
      "Renamed",
    );
  });

  it("undoes one task without losing a later change to another", () => {
    const group = showGroup("today", [today(1), today(2), today(3)]);

    const first = patchTask(queryClient, { taskId: 2, change: () => null });
    patchTask(queryClient, { taskId: 1, change: () => null });
    first.undo();

    expect(group()).toEqual({ ids: [2, 3], total: 2, minutes: 120 });
  });

  it("ticks a subtask, counts it on its parent and undoes both", () => {
    const parent = today(1, { subtaskCount: 1 });
    const group = showOverview("list", [parent]);
    queryClient.setQueryData(["tasks", { id: 1 }], {
      ...parent,
      subtasks: [{ id: 5, title: "Draft", isCompleted: false }],
    });
    const detail = () => queryClient.getQueryData<Task>(["tasks", { id: 1 }]);

    const patch = patchSubtask(queryClient, 1, 5, (subtask) => ({
      ...subtask,
      isCompleted: true,
    }));

    expect(detail()?.subtasks?.[0].isCompleted).toBe(true);
    expect(group()?.tasks[0].subtaskCompletedCount).toBe(1);

    patch.undo();

    expect(detail()?.subtasks?.[0].isCompleted).toBe(false);
    expect(group()?.tasks[0].subtaskCompletedCount).toBe(0);
  });
});
