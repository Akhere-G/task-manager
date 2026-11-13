import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { renderHookWithProviders } from "../../../test/render";
import { useTasks } from "./useTasks";

const mock = mockApi();
const emptyPage = { tasks: [], totalTasks: 0, totalPages: 0, currentPage: 1 };

function lastRequestParams() {
  const url = mock.history.get.at(-1)?.url ?? "";
  return new URLSearchParams(url.split("?")[1]);
}

describe("filtering tasks by priority", () => {
  it("reads the priority filter from the page address", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks({ perPage: 10 }), {
      route: "/?priority=1,2",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().get("priority")).toBe("1,2");
  });

  it("refetches with the new priority and counts it as a search", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(() => useTasks({ perPage: 10 }));
    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().has("priority")).toBe(false);

    act(() => result.current.updateFilters("priority", "1"));

    await waitFor(() => expect(lastRequestParams().get("priority")).toBe("1"));
    expect(result.current.isSearching).toBe(true);
  });
});

describe("smart views", () => {
  it("asks the server for the view in the viewer's zone and projects repeats", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks({ perPage: 10 }), {
      route: "/?view=upcoming",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    const params = lastRequestParams();
    expect(params.get("view")).toBe("upcoming");
    expect(params.get("zone")).toBeTruthy();
    expect(params.get("project_repeating")).toBe("true");
    expect(params.has("start_date")).toBe(false);
  });

  it("sends no view for all tasks", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks({ perPage: 10 }));

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().has("view")).toBe(false);
  });

  it("refetches when another view is selected", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(() => useTasks({ perPage: 10 }));
    await waitFor(() => expect(mock.history.get).toHaveLength(1));

    act(() => result.current.selectView("overdue"));

    await waitFor(() =>
      expect(lastRequestParams().get("view")).toBe("overdue"),
    );
    expect(result.current.view).toBe("overdue");
  });

  it("clears the project filter when the inbox is selected", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(
      () => useTasks({ perPage: 10 }),
      {
        route: "/?project=4",
      },
    );
    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().get("project")).toBe("4");

    act(() => result.current.selectView("inbox"));

    await waitFor(() => expect(lastRequestParams().get("view")).toBe("inbox"));
    expect(lastRequestParams().has("project")).toBe(false);
  });

  it("loads the visible range and no view in the calendar layout", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks({ perPage: 10 }), {
      route: "/?layout=calendar&view=month",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    const params = lastRequestParams();
    expect(params.has("start_date")).toBe(true);
    expect(params.has("end_date")).toBe(true);
    expect(params.has("view")).toBe(false);
    expect(params.has("limit")).toBe(false);
  });

  it("loads one large page of tasks in the matrix layout", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks({ perPage: 10 }), {
      route: "/?layout=matrix",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(result.current.layout).toBe("matrix");
    expect(lastRequestParams().get("limit")).toBe("200");
    expect(lastRequestParams().get("page")).toBe("1");
  });

  it("falls back to the list layout for an unknown layout", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks({ perPage: 10 }), {
      route: "/?layout=timeline",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(result.current.layout).toBe("list");
    expect(lastRequestParams().get("limit")).toBe("10");
  });
});

describe("board layout", () => {
  it("asks for every task of the project in manual order, done or not", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks({ perPage: 10 }), {
      route: "/?layout=kanban&project=7&is_completed=false",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    const params = lastRequestParams();
    expect(result.current.layout).toBe("kanban");
    expect(params.get("project")).toBe("7");
    expect(params.get("is_completed")).toBe("all");
    expect(params.get("sort_by")).toBe("manual");
    expect(params.get("limit")).toBe("200");
  });
});
