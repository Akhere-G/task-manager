import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { heldReply, mockApi } from "../../../test/api";
import { makeTask, renderHookWithProviders } from "../../../test/render";
import { useCategoryTasks } from "../../tasks/hooks/useCategoryTasks";
import { getDefaultFilters } from "../../tasks/taskParams";
import { columnCategoryParams } from "../boardCache";
import useMoveTaskToColumn from "./useMoveTaskToColumn";

const mock = mockApi();
const filters = { ...getDefaultFilters(), isCompleted: "all" };
const card = makeTask({ id: 11, projectId: 7, columnId: 1 });

const columnQuery = (columnId: number) => ({
  filters,
  search: "",
  view: "all" as const,
  params: columnCategoryParams(7, columnId),
});

describe("useMoveTaskToColumn", () => {
  it("shows the card in its new column at once and returns it if refused", async () => {
    const held = heldReply(500);
    mock.onGet(/\/tasks/).reply((config) => {
      const tasks = config.url?.includes("column=1") ? [card] : [];
      return [
        200,
        { tasks, totalTasks: tasks.length, totalMinutes: 0, totalPages: 1 },
      ];
    });
    mock.onPost(/\/tasks\/11\//).reply(held.reply);
    const { result } = renderHookWithProviders(() => ({
      todo: useCategoryTasks(columnQuery(1)),
      done: useCategoryTasks(columnQuery(3)),
      move: useMoveTaskToColumn(),
    }));
    await waitFor(() => expect(result.current.todo.tasks).toHaveLength(1));

    act(() =>
      result.current.move.mutate({
        id: 11,
        move: { columnId: 3, afterId: null, beforeId: null },
        column: { id: 3, onDrop: "complete" },
      }),
    );

    await waitFor(() => expect(result.current.done.tasks).toHaveLength(1));
    expect(result.current.done.tasks[0]).toMatchObject({ isCompleted: true });
    expect(result.current.todo.tasks).toHaveLength(0);
    held.release();

    await waitFor(() => expect(result.current.move.isError).toBe(true));
    await waitFor(() => expect(result.current.todo.tasks).toHaveLength(1));
    expect(result.current.done.tasks).toHaveLength(0);
  });
});
