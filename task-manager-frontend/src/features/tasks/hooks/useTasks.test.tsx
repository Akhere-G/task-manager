import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { renderHookWithProviders } from "../../../test/render";
import { useTasks } from "./useTasks";

const mock = mockApi();
const emptyPage = {
  tasks: [],
  totalTasks: 0,
  totalMinutes: 0,
  totalPages: 0,
  currentPage: 1,
};

function lastRequestParams() {
  const url = mock.history.get.at(-1)?.url ?? "";
  return new URLSearchParams(url.split("?")[1]);
}

describe("filtering tasks by priority", () => {
  it("reads the priority filter from the page address", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks(), {
      route: "/?priority=1,2",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().get("priority")).toBe("1,2");
  });

  it("refetches with the new priority and counts it as a search", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(() => useTasks());
    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().has("priority")).toBe(false);

    act(() => result.current.updateFilters("priority", "1"));

    await waitFor(() => expect(lastRequestParams().get("priority")).toBe("1"));
    expect(result.current.isSearching).toBe(true);
  });
});

describe("inbox and projects", () => {
  it("sends no view for all tasks", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks());

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().has("view")).toBe(false);
  });

  it("falls back to all tasks for a view that no longer exists", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?view=today",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(result.current.view).toBe("all");
    expect(lastRequestParams().has("view")).toBe(false);
  });

  it("clears the project filter when the inbox is selected", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?project=4",
    });
    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().get("project")).toBe("4");

    act(() => result.current.selectInbox());

    await waitFor(() => expect(lastRequestParams().get("view")).toBe("inbox"));
    expect(lastRequestParams().has("project")).toBe(false);
  });

  it("leaves the inbox when a project is selected", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?view=inbox",
    });
    await waitFor(() => expect(mock.history.get).toHaveLength(1));

    act(() => result.current.selectProject("7"));

    await waitFor(() => expect(lastRequestParams().get("project")).toBe("7"));
    expect(lastRequestParams().has("view")).toBe(false);
    expect(result.current.view).toBe("all");
  });

  it("selecting all projects clears the project filter", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);
    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?project=4",
    });
    await waitFor(() => expect(mock.history.get).toHaveLength(1));

    act(() => result.current.selectProject(""));

    await waitFor(() => expect(lastRequestParams().has("project")).toBe(false));
  });

  it("loads the visible range and no view in the calendar layout", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks(), {
      route: "/?layout=calendar&view=month",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    const params = lastRequestParams();
    expect(params.has("start_date")).toBe(true);
    expect(params.has("end_date")).toBe(true);
    expect(params.has("view")).toBe(false);
    expect(params.has("limit")).toBe(false);
  });

  it("asks the matrix layout for one task, only to total it", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?layout=matrix",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(result.current.layout).toBe("matrix");
    expect(lastRequestParams().get("limit")).toBe("1");
    expect(lastRequestParams().get("page")).toBe("1");
  });

  it("falls back to the list layout for an unknown layout", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?layout=timeline",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(result.current.layout).toBe("list");
    expect(lastRequestParams().get("limit")).toBe("1");
  });

  it("does not filter the list by completion, since it shows a group for it", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    renderHookWithProviders(() => useTasks(), {
      route: "/?is_completed=true",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    expect(lastRequestParams().has("is_completed")).toBe(false);
  });
});

describe("dimming old results", () => {
  it("is stale while the previous filter's results show, not while they refresh", async () => {
    let release!: () => void;
    let gate = Promise.resolve();
    const holdNextReply = () => {
      gate = new Promise<void>((resolve) => (release = resolve));
    };
    mock.onGet(/\/tasks/).reply(async () => {
      await gate;
      return [200, emptyPage];
    });
    const { result } = renderHookWithProviders(() => useTasks());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    holdNextReply();
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isStale).toBe(false);
    release();
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    holdNextReply();
    act(() => result.current.updateFilters("priority", "1"));
    await waitFor(() => expect(result.current.isStale).toBe(true));
    release();
    await waitFor(() => expect(result.current.isStale).toBe(false));
  });
});

describe("board layout", () => {
  it("asks for every task of the project in manual order, done or not", async () => {
    mock.onGet(/\/tasks/).reply(200, emptyPage);

    const { result } = renderHookWithProviders(() => useTasks(), {
      route: "/?layout=kanban&project=7&is_completed=false",
    });

    await waitFor(() => expect(mock.history.get).toHaveLength(1));
    const params = lastRequestParams();
    expect(result.current.layout).toBe("kanban");
    expect(params.get("project")).toBe("7");
    expect(params.get("is_completed")).toBe("all");
    expect(params.get("sort_by")).toBe("manual");
    expect(params.get("limit")).toBe("1");
  });
});
