import { useQueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../../test/api";
import { makeTask, renderHookWithProviders } from "../../../test/render";
import type { Subtask, Task } from "../types";
import useReorderSubtasks from "./useReorderSubtasks";

const mock = mockApi();

function subtask(id: number): Subtask {
  return {
    id,
    parentId: 1,
    position: id,
    title: `s${id}`,
    description: null,
    priority: 4,
    isCompleted: false,
    completedAt: null,
  };
}

const subtasks = [subtask(2), subtask(3), subtask(4)];
const KEY = ["tasks", { id: 1 }];

function setup() {
  return renderHookWithProviders(() => ({
    reorder: useReorderSubtasks(1),
    client: useQueryClient(),
  }));
}

const cachedIds = (client: ReturnType<typeof useQueryClient>) =>
  client.getQueryData<Task>(KEY)?.subtasks?.map((item) => item.id);

describe("reordering subtasks", () => {
  it("shows the new order at once and puts the id list", async () => {
    mock.onPut("/tasks/1/subtasks/order").reply(200, { subtasks: [] });
    const { result } = setup();
    result.current.client.setQueryData(KEY, makeTask({ id: 1, subtasks }));

    act(() =>
      result.current.reorder.mutate([subtasks[2], subtasks[0], subtasks[1]]),
    );

    await waitFor(() =>
      expect(cachedIds(result.current.client)).toEqual([4, 2, 3]),
    );
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ ids: [4, 2, 3] });
  });

  it("puts the old order back when the request fails", async () => {
    mock.onPut("/tasks/1/subtasks/order").reply(500);
    const { result } = setup();
    result.current.client.setQueryData(KEY, makeTask({ id: 1, subtasks }));

    act(() =>
      result.current.reorder.mutate([subtasks[2], subtasks[0], subtasks[1]]),
    );

    await waitFor(() => expect(result.current.reorder.isError).toBe(true));
    expect(cachedIds(result.current.client)).toEqual([2, 3, 4]);
  });
});
