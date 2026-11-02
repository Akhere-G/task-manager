import { describe, expect, it } from "vitest";
import { validateTask, validateTaskList } from "./schemas";

const valid = {
  title: "Write report",
  description: "",
  projectId: null,
  startAt: "2026-01-01T10:00",
  endAt: "2026-01-01T11:00",
  isRepeating: false,
  repeatBy: null,
  repeatInterval: 1,
  repeatDays: null,
  repeatTimezone: null,
  repeatUntil: null,
};

describe("validateTask", () => {
  it("accepts a valid task", () => {
    expect(validateTask(valid)).toEqual({});
  });

  it("reports required fields and keeps messages", () => {
    const errors = validateTask({ ...valid, title: " ", startAt: "" });
    expect(errors.title).toBe("Title is mandatory.");
    expect(errors.startAt).toBe("Start At is mandatory.");
  });

  it("accepts a task with no dates", () => {
    expect(validateTask({ ...valid, startAt: null, endAt: null })).toEqual({});
    expect(validateTask({ ...valid, startAt: "", endAt: "" })).toEqual({});
  });

  it("wants both dates or neither", () => {
    expect(validateTask({ ...valid, endAt: null }).endAt).toBe(
      "End At is mandatory.",
    );
    expect(validateTask({ ...valid, startAt: null }).startAt).toBe(
      "Start At is mandatory.",
    );
  });

  it("does not let an undated task repeat", () => {
    const errors = validateTask({
      ...valid,
      startAt: null,
      endAt: null,
      isRepeating: true,
      repeatBy: "daily",
    });
    expect(errors.startAt).toBe(
      "Repeating tasks need a start and an end time.",
    );
  });

  it("rejects long titles, a fractional project id and bad ordering", () => {
    expect(validateTask({ ...valid, title: "a".repeat(256) }).title).toBe(
      "Title must be under 255 characters.",
    );
    expect(validateTask({ ...valid, projectId: 1.5 }).projectId).toBe(
      "Choose one of your projects.",
    );
    expect(validateTask({ ...valid, projectId: 4 })).toEqual({});
    expect(validateTask({ ...valid, endAt: valid.startAt }).endAt).toBe(
      "End At must be after start at.",
    );
  });

  it("validates recurrence", () => {
    const weekly = { ...valid, isRepeating: true, repeatBy: "weekly" };
    expect(validateTask({ ...weekly, repeatDays: [1] })).toEqual({});
    expect(validateTask({ ...weekly, repeatDays: [] }).repeatDays).toBe(
      "Choose at least one day.",
    );
    expect(
      validateTask({ ...weekly, repeatDays: [1], repeatInterval: 53 })
        .repeatInterval,
    ).toBe("Repeat interval must be between 1 and 52.");
    expect(validateTask({ ...weekly, repeatDays: [9] }).repeatDays).toMatch(
      /^Repeat days must be/,
    );
  });
});

describe("validateTaskList", () => {
  it("returns one error map per task", () => {
    expect(validateTaskList([valid, { ...valid, title: "" }])).toEqual([
      {},
      { title: "Title is mandatory." },
    ]);
  });
});
