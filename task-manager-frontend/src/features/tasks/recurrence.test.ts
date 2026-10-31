import { describe, expect, it } from "vitest";
import {
  defaultDays,
  describeRecurrence,
  formatRepeatDays,
  isValidRepeatDay,
  parseRepeatDays,
  parseRepeatInterval,
} from "./recurrence";

describe("describeRecurrence", () => {
  it.each([
    [{ repeatBy: "daily", repeatInterval: 1 }, "Daily"],
    [{ repeatBy: "daily", repeatInterval: 3 }, "Every 3 days"],
    [{ repeatBy: "weekly", repeatDays: [0, 1, 2, 3, 4] }, "Every weekday"],
    [{ repeatBy: "weekly", repeatDays: [5, 6] }, "Every weekend"],
    [{ repeatBy: "weekly", repeatDays: [3, 0] }, "Every Mon and Thu"],
    [{ repeatBy: "weekly", repeatInterval: 2, repeatDays: [0] }, "Mon every 2 weeks"],
    [{ repeatBy: "monthly", repeatDays: [1, 15] }, "The 1st and 15th of every month"],
    [{ repeatBy: "yearly", repeatDays: ["12-25"] }, "25 Dec every year"],
    [{ repeatBy: "monthly" }, "Monthly"],
  ])("describes %o as %s", (recurrence, expected) => {
    expect(describeRecurrence(recurrence)).toBe(expected);
  });
});

describe("defaultDays", () => {
  const monday = "2026-03-02T09:00:00Z";

  it("picks the start's own day with Monday as 0", () => {
    expect(defaultDays(monday, "weekly")).toEqual([0]);
    expect(defaultDays(monday, "monthly")).toEqual([2]);
    expect(defaultDays(monday, "yearly")).toEqual(["03-02"]);
  });

  it("has no days for daily tasks or an invalid start", () => {
    expect(defaultDays(monday, "daily")).toBeNull();
    expect(defaultDays("not a date", "weekly")).toBeNull();
  });
});

describe("repeat days in CSV", () => {
  it("writes weekdays by name and reads names or numbers back", () => {
    expect(formatRepeatDays("weekly", [3, 0])).toBe("Mon;Thu");
    expect(parseRepeatDays("weekly", "Mon; thursday")).toEqual([0, 3]);
    expect(parseRepeatDays("weekly", "0|3")).toEqual([0, 3]);
  });

  it("keeps unreadable cells as text so validation rejects them", () => {
    const days = parseRepeatDays("weekly", "Funday");

    expect(days).toEqual(["Funday"]);
    expect(isValidRepeatDay("weekly", days?.[0])).toBe(false);
  });

  it("treats an empty cell as no days", () => {
    expect(parseRepeatDays("monthly", " ")).toBeNull();
  });

  it("reads intervals as whole numbers only", () => {
    expect(parseRepeatInterval("2")).toBe(2);
    expect(parseRepeatInterval("")).toBeUndefined();
    expect(parseRepeatInterval("two")).toBeNaN();
  });
});

describe("isValidRepeatDay", () => {
  it.each([
    ["weekly", 6, true],
    ["weekly", 7, false],
    ["monthly", 31, true],
    ["monthly", 0, false],
    ["yearly", "02-29", true],
    ["yearly", "02-30", false],
    ["daily", 1, false],
  ])("%s %o is %s", (repeatBy, day, expected) => {
    expect(isValidRepeatDay(repeatBy, day)).toBe(expected);
  });
});
