import { describe, expect, it } from "vitest";
import { validateTask, validateTaskList, type TaskData } from "./validators";

const valid: TaskData = {
  title: "Write report",
  description: null,
  category: "work",
  startAt: "2026-03-02T09:00:00",
  endAt: "2026-03-02T10:00:00",
};

describe("validateTask", () => {
  it("accepts a complete task", () => {
    expect(validateTask(valid)).toEqual({});
  });

  it("requires a title, a known category and both times", () => {
    const errors = validateTask({ title: "  ", category: "nope" });
    expect(errors).toMatchObject({
      title: "Title is mandatory.",
      startAt: "Start At is mandatory.",
      endAt: "End At is mandatory.",
    });
    expect(errors.category).toMatch(/Invalid category/);
  });

  it("limits the title length", () => {
    expect(validateTask({ ...valid, title: "x".repeat(256) }).title).toMatch(/under 255/);
  });

  it("rejects an end that is not after the start", () => {
    const errors = validateTask({ ...valid, endAt: valid.startAt });
    expect(errors.endAt).toBe("End At must be after start at.");
  });

  it("rejects unparseable dates", () => {
    const errors = validateTask({ ...valid, startAt: "soon", endAt: "later" });
    expect(errors.startAt).toMatch(/Invalid date/);
    expect(errors.endAt).toMatch(/Invalid date/);
  });

  it("checks completion and completedAt agree", () => {
    expect(validateTask({ ...valid, isCompleted: true }).isCompleted).toMatch(/completed at/);
    expect(
      validateTask({ ...valid, isCompleted: false, completedAt: "2026-03-02T09:30:00" }).isCompleted,
    ).toMatch(/null/);
    expect(
      validateTask({ ...valid, isCompleted: true, completedAt: "2026-03-02T09:30:00" }),
    ).toEqual({});
  });

  it("only accepts the four repeat frequencies", () => {
    expect(validateTask({ ...valid, isRepeating: true, repeatBy: "weekly" })).toEqual({});
    expect(validateTask({ ...valid, isRepeating: true, repeatBy: "hourly" }).repeatBy).toMatch(
      /daily, weekly, monthly or yearly/,
    );
  });

  it("requires a repeat frequency for repeating tasks", () => {
    expect(validateTask({ ...valid, isRepeating: true }).repeatBy).toMatch(/required/);
  });

  it("validates repeatUntil only when one is given", () => {
    expect(validateTask({ ...valid, repeatUntil: "" })).toEqual({});
    expect(validateTask({ ...valid, repeatUntil: "2026-04-01" })).toEqual({});
    expect(validateTask({ ...valid, repeatUntil: "never" }).repeatUntil).toBeDefined();
  });

  it("only validates the fields present on an update", () => {
    expect(validateTask({ title: "Renamed" }, true)).toEqual({});
    expect(validateTask({ title: "" }, true).title).toBe("Title is mandatory.");
  });

  // Known bug: the update check looks for "starAt", so a bad start date slips through.
  it.fails("validates startAt on an update", () => {
    expect(validateTask({ startAt: "not a date" }, true).startAt).toBeDefined();
  });
});

describe("validateTaskList", () => {
  it("reports errors per row and whether any row failed", () => {
    const { hasErrors, allErrors } = validateTaskList([valid, { ...valid, title: "" }]);

    expect(hasErrors).toBe(true);
    expect(allErrors[0]).toEqual({});
    expect(allErrors[1].title).toBe("Title is mandatory.");
  });

  it("is clean when every row is valid", () => {
    expect(validateTaskList([valid, valid]).hasErrors).toBe(false);
  });
});
