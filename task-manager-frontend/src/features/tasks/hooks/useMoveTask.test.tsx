import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { makeTask, renderHookWithProviders } from "../../../test/render";
import type { GetTaskResult } from "../api";
import useMoveTask from "./useMoveTask";

const mock = mockApi();
const tasks = [1, 2, 3].map((id) => makeTask({ id }));
const page: GetTaskResult = {
  tasks,
  totalTasks: 3,
  totalMinutes: 0,
  totalPages: 1,
  currentPage: 1,
};
const KEY = ["tasks", "category", "list"];
const OTHER_KEY = ["tasks", "category", "other"];
const infinite: InfiniteData<GetTaskResult> = {
  pages: [page],
  pageParams: [1],
};

function setup() {
  return renderHookWithProviders(() => ({
    move: useMoveTask(),
    client: useQueryClient(),
  }));
}

const cachedIds = (client: ReturnType<typeof useQueryClient>) =>
  client
    .getQueryData<InfiniteData<GetTaskResult>>(KEY)
    ?.pages.flatMap((p) => p.tasks)
    .map((task) => task.id);

describe("moving a task", () => {
  it("shows the new order at once and posts the neighbours", async () => {
    mock.onPost("/tasks/3/move").reply(200, {});
    const { result } = setup();
    result.current.client.setQueryData(KEY, infinite);

    act(() =>
      result.current.move.mutate({
        id: 3,
        move: { afterId: null, beforeId: 1 },
        reordered: [tasks[2], tasks[0], tasks[1]],
        queryKey: KEY,
      }),
    );

    await waitFor(() =>
      expect(cachedIds(result.current.client)).toEqual([3, 1, 2]),
    );
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      afterId: null,
      beforeId: 1,
    });
  });

  it("leaves other task queries alone", async () => {
    mock.onPost("/tasks/3/move").reply(200, {});
    const { result } = setup();
    result.current.client.setQueryData(KEY, infinite);
    result.current.client.setQueryData(OTHER_KEY, infinite);

    act(() =>
      result.current.move.mutate({
        id: 3,
        move: { afterId: null, beforeId: 1 },
        reordered: [tasks[2], tasks[0], tasks[1]],
        queryKey: KEY,
      }),
    );

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(
      result.current.client
        .getQueryData<InfiniteData<GetTaskResult>>(OTHER_KEY)
        ?.pages[0].tasks.map((task) => task.id),
    ).toEqual([1, 2, 3]);
  });

  it("puts the old order back when the server refuses", async () => {
    mock.onPost("/tasks/3/move").reply(500);
    mock.onGet(/\/tasks/).reply(200, page);
    const { result } = setup();
    result.current.client.setQueryData(KEY, infinite);

    act(() =>
      result.current.move.mutate({
        id: 3,
        move: { afterId: null, beforeId: 1 },
        reordered: [tasks[2], tasks[0], tasks[1]],
        queryKey: KEY,
      }),
    );

    await waitFor(() => expect(result.current.move.isError).toBe(true));
    await waitFor(() =>
      expect(cachedIds(result.current.client)).toEqual([1, 2, 3]),
    );
  });
});
