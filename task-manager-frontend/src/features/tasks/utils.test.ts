import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Views } from "react-big-calendar";
import { makeTask } from "../../test/render";
import {
  calculateDateRange,
  daysUntilPurge,
  formatDateRange,
  getCalendarTaskId,
  mapTasksToCalendarEvents,
  parsePriority,
} from "./utils";

// Wednesday 11 March 2026, midday UTC (vitest.config.ts pins TZ to UTC).
const NOW = new Date("2026-03-11T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getCalendarTaskId", () => {
  it("edits the series for a ghost and the task itself otherwise", () => {
    expect(
      getCalendarTaskId(makeTask({ id: 7, seriesId: 3, isGhost: true })),
    ).toBe(3);
    expect(getCalendarTaskId(makeTask({ id: 7, seriesId: 3 }))).toBe(7);
  });
});

describe("calculateDateRange", () => {
  it("this_week runs from the start of today through six more days", () => {
    const { start, end } = calculateDateRange("this_week", "2026-03-11");

    expect(start.toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-17T23:59:59.999Z");
  });

  it("calendar_view pads the month so the edge weeks are filled", () => {
    const { start, end } = calculateDateRange("calendar_view", "2026-03-20");

    expect(start.toISOString()).toBe("2026-02-23T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-06T23:59:59.999Z");
  });

  it("overdue ends where today starts", () => {
    expect(calculateDateRange("overdue", "2026-03-11").end.toISOString()).toBe(
      "2026-03-11T00:00:00.000Z",
    );
  });
});

describe("undated tasks", () => {
  it("are labelled and kept off the calendar", () => {
    const undated = makeTask({ id: 2, startAt: null, endAt: null });
    expect(formatDateRange(null, null)).toBe("No date");
    expect(
      mapTasksToCalendarEvents(
        [undated, makeTask({ id: 3 })],
        false,
        Views.WEEK,
      ).map((event) => event.id),
    ).toEqual([3]);
    expect(mapTasksToCalendarEvents([undated], true, Views.MONTH)).toEqual([]);
  });
});

describe("formatDateRange", () => {
  it("shows only times for a task today", () => {
    expect(
      formatDateRange("2026-03-11T09:00:00Z", "2026-03-11T10:30:00Z"),
    ).toBe("09:00 - 10:30");
  });

  it("adds the year for a task in another year", () => {
    expect(
      formatDateRange("2027-01-05T09:00:00Z", "2027-01-05T10:00:00Z"),
    ).toBe("5 Jan 27, 09:00 - 10:00");
  });
});

describe("mapTasksToCalendarEvents", () => {
  const tasks = [
    makeTask({
      id: 1,
      startAt: "2026-03-11T09:00:00Z",
      endAt: "2026-03-11T10:00:00Z",
    }),
    makeTask({
      id: 2,
      startAt: "2026-03-11T14:00:00Z",
      endAt: "2026-03-11T15:00:00Z",
    }),
    makeTask({
      id: 3,
      title: "",
      startAt: "2026-03-12T09:00:00Z",
      endAt: "2026-03-12T10:00:00Z",
    }),
  ];

  it("makes one timed event per task, keeping the task for drag and drop", () => {
    const events = mapTasksToCalendarEvents(tasks, false, Views.WEEK);

    expect(events.map((event) => event.resource)).toEqual(tasks);
    expect(events[2].title).toBe("(No Title)");
    expect(events[0].start).toEqual(new Date("2026-03-11T09:00:00Z"));
  });

  it("collapses a mobile month view into one counted event per day", () => {
    const events = mapTasksToCalendarEvents(tasks, true, Views.MONTH);

    expect(events.map((event) => [event.id, event.resource])).toEqual([
      ["2026-03-11", 2],
      ["2026-03-12", 1],
    ]);
  });
});

describe("parsePriority", () => {
  it.each([
    ["1", 1],
    ["P2", 2],
    [" p3 ", 3],
    ["4", 4],
  ])("reads %j as P%i", (cell, expected) => {
    expect(parsePriority(cell)).toBe(expected);
  });

  it.each(["", "0", "5", "high", "P12", undefined])(
    "treats %j as P4",
    (cell) => {
      expect(parsePriority(cell)).toBe(4);
    },
  );
});

describe("daysUntilPurge", () => {
  it.each([
    ["2026-04-10T12:00:00Z", 30],
    ["2026-03-12T12:00:00Z", 1],
    ["2026-03-11T13:00:00Z", 1],
    ["2026-03-11T12:00:00Z", 0],
    ["2026-03-01T12:00:00Z", 0],
  ])("counts %s as %i day(s) left", (purgeAt, expected) => {
    expect(daysUntilPurge(purgeAt)).toBe(expected);
  });
});
