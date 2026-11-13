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
  it("puts tasks with no column in Unassigned, which comes first", () => {
    const groups = groupByColumn(tasks, columns);

    expect([...groups.keys()]).toEqual([null, 10, 20]);
    expect(ids(groups.get(null))).toEqual([4]);
    expect(ids(groups.get(10))).toEqual([1, 2]);
    expect(ids(groups.get(20))).toEqual([3]);
  });

  it("treats a column the board does not know as unassigned", () => {
    const groups = groupByColumn([makeTask({ id: 9, columnId: 99 })], columns);

    expect(ids(groups.get(null))).toEqual([9]);
  });
});

describe("dropTask", () => {
  const groups = groupByColumn(tasks, columns);
  const onTask = (taskId: number) => ({ type: "task", taskId }) as const;
  const onColumn = (columnId: number | null) =>
    ({ type: "column", columnId }) as const;

  it("moves a task before a task of another column", () => {
    const result = dropTask(groups, 1, onTask(3));

    expect(ids(result?.columns.get(10))).toEqual([2]);
    expect(ids(result?.columns.get(20))).toEqual([1, 3]);
    expect(result?.move).toEqual({ columnId: 20, afterId: null, beforeId: 3 });
  });

  it("appends to a column when dropped on the column itself", () => {
    const result = dropTask(groups, 1, onColumn(20));

    expect(ids(result?.columns.get(20))).toEqual([3, 1]);
    expect(result?.move).toEqual({ columnId: 20, afterId: 3, beforeId: null });
  });

  it("reorders inside a column", () => {
    const result = dropTask(groups, 1, onTask(2));

    expect(ids(result?.columns.get(10))).toEqual([2, 1]);
    expect(result?.move).toEqual({ columnId: 10, afterId: 2, beforeId: null });
  });

  it("moves a task out of a column into Unassigned and back", () => {
    const out = dropTask(groups, 3, onColumn(null));

    expect(ids(out?.columns.get(null))).toEqual([4, 3]);
    expect(out?.move).toEqual({ columnId: null, afterId: 4, beforeId: null });

    const back = dropTask(groups, 4, onColumn(10));
    expect(back?.move).toEqual({ columnId: 10, afterId: 2, beforeId: null });
  });

  it("drops into an empty column with no neighbours", () => {
    const board = groupByColumn([tasks[0]], columns);

    expect(dropTask(board, 1, onColumn(20))?.move).toEqual({
      columnId: 20,
      afterId: null,
      beforeId: null,
    });
  });

  it("does nothing when a task is dropped on itself or its own column's end", () => {
    expect(dropTask(groups, 1, onTask(1))).toBeNull();
    expect(dropTask(groups, 2, onColumn(10))).toBeNull();
  });
});

describe("applyOnDrop", () => {
  const task = makeTask({ id: 1, columnId: 10, isCompleted: false });
  const target = (onDrop: ProjectColumn["onDrop"]) => ({ id: 20, onDrop });

  it("completes, reopens, or leaves the task, and puts it in the column", () => {
    expect(applyOnDrop(task, target("complete"))).toMatchObject({
      columnId: 20,
      isCompleted: true,
    });
    expect(
      applyOnDrop({ ...task, isCompleted: true }, target("uncomplete")),
    ).toMatchObject({ isCompleted: false });
    expect(applyOnDrop(task, target("nothing"))).toMatchObject({
      columnId: 20,
      isCompleted: false,
    });
  });

  it("removes the task for a delete column", () => {
    expect(applyOnDrop(task, target("delete"))).toBeNull();
  });

  it("only clears the column for Unassigned", () => {
    expect(applyOnDrop({ ...task, isCompleted: true }, null)).toMatchObject({
      columnId: null,
      isCompleted: true,
    });
  });
});
