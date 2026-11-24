import { describe, expect, it } from "vitest";
import {
  formatClock,
  restPhaseAfter,
  sessionCount,
} from "./plan";

describe("sessionCount", () => {
  it("rounds up to whole work blocks", () => {
    expect(sessionCount(60, 25)).toBe(3);
    expect(sessionCount(50, 25)).toBe(2);
  });

  it("is at least one session, even for a task with no duration", () => {
    expect(sessionCount(0, 25)).toBe(1);
  });
});

describe("restPhaseAfter", () => {
  it("gives a long rest after every fourth session", () => {
    expect([1, 2, 3, 4, 5, 8].map(restPhaseAfter)).toEqual([
      "rest",
      "rest",
      "rest",
      "longRest",
      "rest",
      "longRest",
    ]);
  });
});

describe("formatClock", () => {
  it("pads minutes and seconds", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(0)).toBe("00:00");
  });

  it("prefixes overtime with a minus sign", () => {
    expect(formatClock(-133)).toBe("-02:13");
  });
});
