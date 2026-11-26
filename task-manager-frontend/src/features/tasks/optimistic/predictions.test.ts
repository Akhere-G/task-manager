import { describe, expect, it } from "vitest";
import { makeTask } from "../../../test/render";
import { predictSnooze, predictUpdate } from "./predictions";

const WEDNESDAY = new Date("2026-03-04T12:00:00Z");
const SATURDAY = new Date("2026-03-07T12:00:00Z");
const MONDAY = new Date("2026-03-09T12:00:00Z");

describe("predicting a snooze", () => {
  it.each([
    ["tomorrow", WEDNESDAY, undefined, "2026-03-05"],
    ["weekend", WEDNESDAY, undefined, "2026-03-07"],
    ["weekend", SATURDAY, undefined, "2026-03-08"],
    ["next_week", WEDNESDAY, undefined, "2026-03-09"],
    ["next_week", MONDAY, undefined, "2026-03-16"],
    ["date", WEDNESDAY, "2026-03-20", "2026-03-20"],
  ] as const)(
    "%s from %s keeps the time of day and length",
    (preset, now, day, expected) => {
      const task = makeTask({
        startAt: "2026-03-02T14:15:00Z",
        endAt: "2026-03-02T15:45:00Z",
      });

      const snoozed = predictSnooze(preset, day, now)(task);

      expect(snoozed.startAt).toBe(`${expected}T14:15:00.000Z`);
      expect(snoozed.endAt).toBe(`${expected}T15:45:00.000Z`);
    },
  );

  it("gives an undated task half an hour from 09:00", () => {
    const task = makeTask({ startAt: null, endAt: null });

    const snoozed = predictSnooze("tomorrow", undefined, WEDNESDAY)(task);

    expect(snoozed.startAt).toBe("2026-03-05T09:00:00.000Z");
    expect(snoozed.endAt).toBe("2026-03-05T09:30:00.000Z");
  });

  it("leaves the next occurrence to the server", () => {
    const task = makeTask({ isRepeating: true, repeatBy: "daily" });

    expect(predictSnooze("next_occurrence", undefined, WEDNESDAY)(task)).toBe(
      task,
    );
  });
});

describe("predicting an update", () => {
  const subtask = {
    id: 5,
    parentId: 1,
    position: 0,
    title: "Draft",
    description: null,
    priority: 4,
    isCompleted: false,
    completedAt: null,
  } as const;

  it("completes the open subtasks of a task that does not repeat", () => {
    const task = makeTask({ subtaskCount: 1, subtasks: [subtask] });

    const done = predictUpdate({ isCompleted: true })(task);

    expect(done.subtasks?.[0].isCompleted).toBe(true);
    expect(done.subtaskCompletedCount).toBe(1);
  });

  it("leaves a repeating task's subtasks for the next occurrence", () => {
    const task = makeTask({
      isRepeating: true,
      subtaskCount: 1,
      subtasks: [subtask],
    });

    const done = predictUpdate({ isCompleted: true })(task);

    expect(done.subtasks?.[0].isCompleted).toBe(false);
  });

  it("takes the task out of its column when the project changes", () => {
    const task = makeTask({ projectId: 1, columnId: 3 });

    expect(predictUpdate({ projectId: 2 })(task).columnId).toBeNull();
    expect(predictUpdate({ projectId: 1 })(task).columnId).toBe(3);
  });

  it("keeps the current project until a newly named one has an id", () => {
    const task = makeTask({ projectId: 1, columnId: 3 });

    const next = predictUpdate({ projectId: null, projectName: "Garden" })(
      task,
    );

    expect(next.projectId).toBe(1);
    expect(next.columnId).toBe(3);
  });
});
