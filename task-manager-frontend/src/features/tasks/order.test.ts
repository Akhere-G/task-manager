import { describe, expect, it } from "vitest";
import { makeTask } from "../../test/render";
import { reorder } from "./order";

const tasks = [1, 2, 3].map((id) => makeTask({ id, title: `t${id}` }));

describe("reorder", () => {
  it("names the neighbours of the new spot", () => {
    expect(reorder(tasks, 3, 1)).toMatchObject({
      tasks: [{ id: 3 }, { id: 1 }, { id: 2 }],
      move: { afterId: null, beforeId: 1 },
    });
  });

  it("moves to the bottom and the middle", () => {
    expect(reorder(tasks, 1, 3)).toMatchObject({
      move: { afterId: 3, beforeId: null },
    });
    expect(reorder(tasks, 1, 2)).toMatchObject({
      move: { afterId: 2, beforeId: 3 },
    });
  });

  it("does nothing when a task is dropped on itself", () => {
    expect(reorder(tasks, 2, 2)).toBeNull();
  });
});
