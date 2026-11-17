import type { InfiniteData } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeQueryClient, makeTask } from "../../test/render";
import type { GetTaskResult } from "../tasks/api";
import type { Task } from "../tasks/types";
import { useCategoryTasks } from "../tasks/hooks/useCategoryTasks";
import { QueryClientProvider } from "@tanstack/react-query";
import { columnCategoryParams, readBoardGroups } from "./boardCache";
import type { ProjectColumn } from "./types";

const column = (id: number): ProjectColumn => ({
  id,
  projectId: 7,
  name: `col${id}`,
  status: "pending",
  colour: "#000000",
  onDrop: "nothing",
  position: id,
});

const filters = {
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

const pages = (...pageTasks: Task[][]): InfiniteData<GetTaskResult> => ({
  pageParams: pageTasks.map((_, index) => index + 1),
  pages: pageTasks.map((tasks, index) => ({
    tasks,
    totalTasks: 3,
    totalMinutes: 0,
    totalPages: pageTasks.length,
    currentPage: index + 1,
  })),
});

describe("columnCategoryParams", () => {
  it("names a column or the unassigned bucket of a project", () => {
    expect(columnCategoryParams(7, 3)).toEqual({ project: "7", column: "3" });
    expect(columnCategoryParams(7, null)).toEqual({
      project: "7",
      unassigned: "true",
    });
  });
});

describe("readBoardGroups", () => {
  it("collects what each active column has loaded, page after page", () => {
    const queryClient = makeQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const seed = (
      columnId: number | null,
      data: InfiniteData<GetTaskResult>,
    ) => {
      const params = columnCategoryParams(7, columnId);
      queryClient.setQueryData(
        [
          "tasks",
          "category",
          {
            categoryFilters: filters,
            search: "",
            view: "all",
            params,
            includeProjections: false,
          },
        ],
        data,
      );
      renderHook(
        () =>
          useCategoryTasks({
            filters,
            search: "",
            view: "all",
            params,
          }),
        { wrapper },
      );
    };
    seed(null, pages([makeTask({ id: 1 })]));
    seed(10, pages([makeTask({ id: 2 })], [makeTask({ id: 3 })]));

    const groups = readBoardGroups(queryClient, 7, [column(10), column(20)]);

    expect([...groups.keys()]).toEqual([null, 10, 20]);
    expect(groups.get(null)?.map((task) => task.id)).toEqual([1]);
    expect(groups.get(10)?.map((task) => task.id)).toEqual([2, 3]);
    expect(groups.get(20)).toEqual([]);
  });
});
