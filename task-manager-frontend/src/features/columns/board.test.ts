import { describe, expect, it } from "vitest";
import { makeTask } from "../../test/render";
import { applyOnDrop, dropTask, groupByColumn } from "./board";
import type { ProjectColumn } from "./types";

const column = (id: number): ProjectColumn => ({
  id,
  projectId: 1,
  name: `col${id}`,
  status: `status${id}`,
  colour: "#000000",
  onDrop: "nothing",
  position: id,
});

const columns = [column(10), column(20)];
const tasks = [
  makeTask({ id: 1, columnId: 10 }),
  makeTask({ id: 2, columnId: 10 }),
  makeTask({ id: 3, columnId: 20 }),
  makeTask({ id: 4, columnId: null }),
];

const ids = (list: { id: number }[] | undefined) => list?.map((t) => t.id);

describe("groupByColumn", () => {
  it("groups by column, putting tasks with no column in the first", () => {
    const groups = groupByColumn(tasks, columns);

    expect(ids(groups.get(10))).toEqual([1, 2, 4]);
    expect(ids(groups.get(20))).toEqual([3]);
  });
});

describe("dropTask", () => {
  const groups = groupByColumn(tasks.slice(0, 3), columns);

  it("moves a task before another task of a different column", () => {
    const result = dropTask(groups, 1, 3, false);

    expect(ids(result?.columns.get(10))).toEqual([2]);
    expect(ids(result?.columns.get(20))).toEqual([1, 3]);
    expect(result?.move).toEqual({ columnId: 20, afterId: null, beforeId: 3 });
  });

  it("appends to a column when dropped on the column itself", () => {
    const result = dropTask(groups, 1, 20, true);

    expect(ids(result?.columns.get(20))).toEqual([3, 1]);
    expect(result?.move).toEqual({ columnId: 20, afterId: 3, beforeId: null });
  });

  it("reorders inside a column", () => {
    const result = dropTask(groups, 1, 2, false);

    expect(ids(result?.columns.get(10))).toEqual([2, 1]);
    expect(result?.move).toEqual({ columnId: 10, afterId: 2, beforeId: null });
  });

  it("drops into an empty column with no neighbours", () => {
    const result = dropTask(groupByColumn([tasks[0]], columns), 1, 20, true);

    expect(result?.move).toEqual({
      columnId: 20,
      afterId: null,
      beforeId: null,
    });
  });

  it("does nothing when a task is dropped on itself or its own column's end", () => {
    expect(dropTask(groups, 1, 1, false)).toBeNull();
    expect(dropTask(groups, 2, 10, true)).toBeNull();
  });
});

describe("applyOnDrop", () => {
  const task = makeTask({ id: 1, columnId: 10, isCompleted: false });

  it("completes, reopens, or leaves the task, and puts it in the column", () => {
    expect(applyOnDrop(task, 20, "complete")).toMatchObject({
      columnId: 20,
      isCompleted: true,
    });
    expect(
      applyOnDrop({ ...task, isCompleted: true }, 20, "uncomplete"),
    ).toMatchObject({ isCompleted: false });
    expect(applyOnDrop(task, 20, "nothing")).toMatchObject({
      columnId: 20,
      isCompleted: false,
    });
  });

  it("removes the task for a delete column", () => {
    expect(applyOnDrop(task, 20, "delete")).toBeNull();
  });
});
