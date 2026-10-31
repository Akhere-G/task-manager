import { describe, expect, it } from "vitest";
import { validateTask, validateTaskList } from "./schemas";

const valid = {
  title: "Write report",
  description: "",
  category: "work",
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
    const errors = validateTask({ ...valid, title: " ", category: "" });
    expect(errors.title).toBe("Title is mandatory.");
    expect(errors.category).toBe("Category is mandatory.");
  });

  it("rejects long titles, unknown categories and bad ordering", () => {
    expect(validateTask({ ...valid, title: "a".repeat(256) }).title).toBe(
      "Title must be under 255 characters.",
    );
    expect(validateTask({ ...valid, category: "nope" }).category).toMatch(
      /^Invalid category/,
    );
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
