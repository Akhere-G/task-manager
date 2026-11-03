import { describe, expect, it } from "vitest";
import { makeTask } from "../../test/render";
import { reorder } from "./order";

const tasks = [1, 2, 3].map((id) => makeTask({ id, title: `t${id}` }));
const ids = (list: { id: number }[]) => list.map((task) => task.id);

describe("reorder", () => {
  it("names the neighbours of the new spot", () => {
    const result = reorder(tasks, 3, 1);

    expect(ids(result!.tasks)).toEqual([3, 1, 2]);
    expect(result!.move).toEqual({ afterId: null, beforeId: 1 });
  });

  it("moves to the bottom and the middle", () => {
    expect(reorder(tasks, 1, 3)!.move).toEqual({ afterId: 3, beforeId: null });
    expect(reorder(tasks, 1, 2)!.move).toEqual({ afterId: 2, beforeId: 3 });
  });

  it("does nothing when a task is dropped on itself", () => {
    expect(reorder(tasks, 2, 2)).toBeNull();
  });
});
