import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Views } from "react-big-calendar";
import { makeTask } from "../../test/render";
import {
  calculateDateRange,
  formatDate,
  formatDateRange,
  formatDateRelative,
  getCalendarTaskId,
  getEventClassName,
  mapTasksToCalendarEvents,
  skipDate,
} from "./utils";

// Wednesday 11 March 2026, midday. The suite pins TZ to UTC (see vitest.config.ts).
const NOW = new Date("2026-03-11T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("skipDate", () => {
  const monday = new Date("2026-03-02T09:00:00Z");

  it.each([
    ["daily", "2026-03-03T09:00:00.000Z"],
    ["weekly", "2026-03-09T09:00:00.000Z"],
    ["monthly", "2026-04-02T09:00:00.000Z"],
    ["yearly", "2027-03-02T09:00:00.000Z"],
  ])("moves a %s task to its next occurrence", (repeatBy, expected) => {
    expect(skipDate(monday, repeatBy).toISOString()).toBe(expected);
  });

  it("clamps a month-end date to the shorter month", () => {
    expect(skipDate(new Date("2026-01-31T09:00:00Z"), "monthly").toISOString()).toBe(
      "2026-02-28T09:00:00.000Z",
    );
  });

  it("refuses an unknown frequency", () => {
    expect(() => skipDate(monday, "hourly")).toThrow(/Repeat by must be one of/);
  });
});

describe("calculateDateRange", () => {
  it("covers today for today and for unknown filters", () => {
    for (const type of ["today", "something_else"]) {
      const { start, end } = calculateDateRange(type, "2026-03-11");
      expect(start.toISOString()).toBe("2026-03-11T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-03-11T23:59:59.999Z");
    }
  });

  it("this_week runs from today through the next six days", () => {
    const { start, end } = calculateDateRange("this_week", "2026-03-11");
    expect(start.toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-17T23:59:59.999Z");
  });

  it("this_month runs thirty days ahead of today", () => {
    expect(calculateDateRange("this_month", "2026-03-11").end.toISOString()).toBe(
      "2026-04-10T23:59:59.999Z",
    );
  });

  it("overdue covers everything before today", () => {
    const { start, end } = calculateDateRange("overdue", "2026-03-11");
    expect(start.getFullYear()).toBe(2000);
    expect(end.toISOString()).toBe("2026-03-11T00:00:00.000Z");
  });

  it("calendar_view pads the displayed month by six days either side", () => {
    const { start, end } = calculateDateRange("calendar_view", "2026-03-15");
    expect(start.toISOString()).toBe("2026-02-23T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-06T23:59:59.999Z");
  });

  it("calendar_view follows the month shown, not today", () => {
    const { start } = calculateDateRange("calendar_view", "2026-08-01");
    expect(start.toISOString()).toBe("2026-07-26T00:00:00.000Z");
  });
});

describe("date formatting", () => {
  it("formats a date for the API", () => {
    expect(formatDate("2026-03-02T23:30:00")).toBe("2026-03-02");
    expect(formatDate()).toBe("2026-03-11");
  });

  it("shows only times for a task that is today", () => {
    expect(formatDateRange("2026-03-11T09:00:00", "2026-03-11T10:30:00")).toBe(
      "09:00 - 10:30",
    );
  });

  it("shows the date for another day this year, and the year for other years", () => {
    expect(formatDateRange("2026-03-02T09:00:00", "2026-03-02T10:00:00")).toBe(
      "2 Mar, 09:00 - 10:00",
    );
    expect(formatDateRange("2025-12-30T09:00:00", "2025-12-30T10:00:00")).toBe(
      "30 Dec 25, 09:00 - 10:00",
    );
  });

  it("shows both dates for a task that spans days", () => {
    expect(formatDateRange("2026-03-02T09:00:00", "2026-03-03T10:00:00")).toBe(
      "2 Mar, 09:00 - 3 Mar, 10:00",
    );
  });

  it("formats relative dates by how far away they are", () => {
    expect(formatDateRelative("2026-03-11T15:45:00")).toBe("3:45 PM");
    expect(formatDateRelative("2026-01-05T10:00:00")).toBe("05 Jan");
    expect(formatDateRelative("2024-01-05T10:00:00")).toBe("05 Jan 2024");
  });

  // Known bug: the default argument is "", which parses to an invalid date.
  it.fails("does not throw when no date is given", () => {
    expect(() => formatDateRelative()).not.toThrow();
  });
});

describe("calendar helpers", () => {
  it("uses the series id for ghosts so edits reach the stored task", () => {
    const ghost = makeTask({ id: 0, isGhost: true, seriesId: 42 });
    expect(getCalendarTaskId(ghost)).toBe(42);
    expect(getCalendarTaskId(makeTask({ id: 7 }))).toBe(7);
  });

  it("maps each task to a timed calendar event", () => {
    const task = makeTask({ title: "" });
    const [event] = mapTasksToCalendarEvents([task], false, Views.MONTH);
    expect(event).toMatchObject({ title: "(No Title)", allDay: false, resource: task });
    expect(event.start).toEqual(new Date("2026-03-02T09:00:00Z"));
    expect(event.end).toEqual(new Date("2026-03-02T10:00:00Z"));
  });

  it("collapses a mobile month view to one all-day marker per day with a count", () => {
    const tasks = [
      makeTask({ id: 1, startAt: "2026-03-02T09:00:00Z" }),
      makeTask({ id: 2, startAt: "2026-03-02T15:00:00Z" }),
      makeTask({ id: 3, startAt: "2026-03-04T09:00:00Z" }),
    ];

    const events = mapTasksToCalendarEvents(tasks, true, Views.MONTH);

    expect(events.map((e) => [e.id, e.resource, e.allDay])).toEqual([
      ["2026-03-02", 2, true],
      ["2026-03-04", 1, true],
    ]);
  });

  it("keeps individual events on mobile outside the month view", () => {
    const events = mapTasksToCalendarEvents([makeTask()], true, Views.WEEK);
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(false);
  });

  it("styles completed and pending events differently", () => {
    const done = getEventClassName({ resource: makeTask({ isCompleted: true }) }, false, Views.WEEK);
    const open = getEventClassName({ resource: makeTask() }, false, Views.WEEK);
    expect(done).toContain("line-through");
    expect(open).not.toContain("line-through");
  });
});
