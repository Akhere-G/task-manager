import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockApi } from "../../../test/api";
import { makeTask, renderHookWithProviders } from "../../../test/render";
import type { TaskFilters } from "../taskParams";
import { useCategoryTasks } from "./useCategoryTasks";

const mock = mockApi();

const filters: TaskFilters = {
  search: "",
  project: "",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "false",
  sortBy: "start_at",
  order: "asc",
  currentDate: "",
};

const pageOf = (ids: number[], currentPage: number, totalTasks: number) => ({
  tasks: ids.map((id) => makeTask({ id })),
  totalTasks,
  totalMinutes: totalTasks * 60,
  totalPages: Math.ceil(totalTasks / 10),
  currentPage,
});

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const requestedParams = (index: number) =>
  new URL(mock.history.get[index].url ?? "", "http://api").searchParams;

describe("useCategoryTasks", () => {
  it("asks for ten tasks of the category and reports its totals", async () => {
    mock.onGet(/\/tasks/).reply(200, pageOf(range(1, 10), 1, 14));

    const { result } = renderHookWithProviders(() =>
      useCategoryTasks({
        filters,
        search: "",
        view: "all",
        overrides: { priority: "2" },
      }),
    );

    await waitFor(() => expect(result.current.tasks).toHaveLength(10));
    const params = requestedParams(0);
    expect(params.get("limit")).toBe("10");
    expect(params.get("page")).toBe("1");
    expect(params.get("priority")).toBe("2");
    expect(result.current.total).toBe(14);
    expect(result.current.totalMinutes).toBe(840);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("loads the next page and appends it", async () => {
    mock
      .onGet(/page=1/)
      .reply(200, pageOf(range(1, 10), 1, 12))
      .onGet(/page=2/)
      .reply(200, pageOf([11, 12], 2, 12));

    const { result } = renderHookWithProviders(() =>
      useCategoryTasks({ filters, search: "", view: "all" }),
    );
    await waitFor(() => expect(result.current.tasks).toHaveLength(10));

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.tasks).toHaveLength(12));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("sends the params that define a board column", async () => {
    mock.onGet(/\/tasks/).reply(200, pageOf([], 1, 0));

    renderHookWithProviders(() =>
      useCategoryTasks({
        filters,
        search: "",
        view: "all",
        params: { project: "7", column: "3" },
      }),
    );

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    const params = requestedParams(0);
    expect(params.get("project")).toBe("7");
    expect(params.get("column")).toBe("3");
  });

  it("does not fetch while disabled", async () => {
    mock.onGet(/\/tasks/).reply(200, pageOf([], 1, 0));

    renderHookWithProviders(() =>
      useCategoryTasks({ filters, search: "", view: "all", enabled: false }),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mock.history.get).toHaveLength(0);
  });
});
