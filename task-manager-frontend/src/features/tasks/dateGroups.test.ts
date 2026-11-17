import { describe, expect, it } from "vitest";

import { makeTask } from "../../test/render";
import { groupTasksByDate } from "./dateGroups";
import { formatMinutes, isTaskOverdue, taskMinutes } from "./utils";

const NOW = new Date("2026-06-28T12:00:00Z");

const at = (id: number, start: string, end: string, extra = {}) =>
  makeTask({ id, startAt: start, endAt: end, ...extra });

describe("groupTasksByDate", () => {
  it("names the overdue, today, tomorrow and upcoming groups", () => {
    const groups = groupTasksByDate(
      [
        at(1, "2026-06-18T23:00:00Z", "2026-06-19T00:00:00Z"),
        at(2, "2026-06-28T19:00:00Z", "2026-06-28T20:00:00Z"),
        at(3, "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
        at(4, "2026-06-30T16:44:00Z", "2026-06-30T16:59:00Z"),
      ],
      NOW,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Overdue",
      "Today · Sun, 28 Jun",
      "Tomorrow · Mon, 29 Jun",
      "Upcoming · Tue, 30 Jun",
    ]);
    expect(groups.map((group) => group.kind)).toEqual([
      "overdue",
      "today",
      "tomorrow",
      "upcoming",
    ]);
  });

  it("puts tasks of one day together and totals their minutes", () => {
    const [today] = groupTasksByDate(
      [
        at(1, "2026-06-28T19:00:00Z", "2026-06-28T20:00:00Z"),
        at(2, "2026-06-28T23:00:00Z", "2026-06-28T23:30:00Z"),
      ],
      NOW,
    );

    expect(today.tasks.map((task) => task.id)).toEqual([1, 2]);
    expect(today.totalMinutes).toBe(90);
  });

  it("does not call a finished task overdue", () => {
    const [group] = groupTasksByDate(
      [
        at(1, "2026-06-20T09:00:00Z", "2026-06-20T10:00:00Z", {
          isCompleted: true,
        }),
      ],
      NOW,
    );

    expect(group.kind).toBe("earlier");
    expect(group.label).toBe("Sat, 20 Jun");
  });

  it("groups tasks without a date last, in arrival order", () => {
    const groups = groupTasksByDate(
      [
        at(1, "2026-06-29T10:00:00Z", "2026-06-29T11:00:00Z"),
        makeTask({ id: 2, startAt: null, endAt: null }),
      ],
      NOW,
    );

    expect(groups.map((group) => group.key)).toEqual(["2026-06-29", "none"]);
    expect(groups[1].totalMinutes).toBe(0);
  });

  it("keeps one group per key even when its tasks are not next to each other", () => {
    const groups = groupTasksByDate(
      [
        at(1, "2026-06-28T19:00:00Z", "2026-06-28T20:00:00Z"),
        at(2, "2026-06-18T19:00:00Z", "2026-06-18T20:00:00Z"),
        at(3, "2026-06-28T21:00:00Z", "2026-06-28T22:00:00Z"),
      ],
      NOW,
    );

    expect(groups.map((group) => group.kind)).toEqual(["today", "overdue"]);
    expect(groups[0].tasks).toHaveLength(2);
  });
});

describe("task time helpers", () => {
  it.each([
    [0, "0m"],
    [15, "15m"],
    [60, "1h"],
    [90, "1h 30m"],
    [125, "2h 5m"],
  ])("formats %i minutes as %s", (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });

  it("measures a task's length and treats undated ones as empty", () => {
    expect(
      taskMinutes({
        startAt: "2026-06-28T10:00:00Z",
        endAt: "2026-06-28T11:30:00Z",
      }),
    ).toBe(90);
    expect(taskMinutes({ startAt: null, endAt: null })).toBe(0);
  });

  it("says a task is overdue only when it is open and past its end", () => {
    const past = "2026-06-28T10:00:00Z";
    expect(isTaskOverdue({ isCompleted: false, endAt: past }, NOW)).toBe(true);
    expect(isTaskOverdue({ isCompleted: true, endAt: past }, NOW)).toBe(false);
    expect(isTaskOverdue({ isCompleted: false, endAt: null }, NOW)).toBe(false);
  });
});
