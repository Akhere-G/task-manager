import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./constants";
import {
  clearSession,
  hasStarted,
  initialSession,
  loadSession,
  pause,
  remainingSeconds,
  resetPhase,
  resume,
  saveSession,
  startNextSession,
  startRest,
  withIdleDuration,
} from "./session";

const T0 = 1_000_000;
const seconds = (n: number) => n * 1000;

describe("the clock", () => {
  it("starts full and paused", () => {
    const state = initialSession(DEFAULT_SETTINGS);
    expect(remainingSeconds(state, T0)).toBe(1500);
    expect(hasStarted(state, T0)).toBe(false);
  });

  it("counts down only while running", () => {
    const running = resume(initialSession(DEFAULT_SETTINGS), T0);
    expect(remainingSeconds(running, T0 + seconds(60))).toBe(1440);

    const paused = pause(running, T0 + seconds(60));
    expect(remainingSeconds(paused, T0 + seconds(600))).toBe(1440);
    expect(hasStarted(paused, T0 + seconds(600))).toBe(true);
  });

  it("keeps counting below zero as overtime", () => {
    const running = resume(initialSession(DEFAULT_SETTINGS), T0);
    expect(remainingSeconds(running, T0 + seconds(1500 + 133))).toBe(-133);
  });

  it("resets the current phase to its full length, paused", () => {
    const running = resume(initialSession(DEFAULT_SETTINGS), T0);
    const reset = resetPhase(pause(running, T0 + seconds(90)));
    expect(remainingSeconds(reset, T0 + seconds(500))).toBe(1500);
    expect(hasStarted(reset, T0 + seconds(500))).toBe(false);
  });
});

describe("phase transitions", () => {
  const working = resume(initialSession(DEFAULT_SETTINGS), T0);

  it("counts the session and starts a running rest", () => {
    const rest = startRest(working, DEFAULT_SETTINGS, T0 + seconds(10));
    expect(rest).toMatchObject({
      phase: "rest",
      session: 1,
      completedSessions: 1,
      durationSeconds: 300,
      elapsedMs: 0,
      runningSince: T0 + seconds(10),
    });
  });

  it("starts a long rest after the fourth session", () => {
    const fourth = { ...working, session: 4, completedSessions: 3 };
    expect(startRest(fourth, DEFAULT_SETTINGS, T0)).toMatchObject({
      phase: "longRest",
      completedSessions: 4,
      durationSeconds: 900,
    });
  });

  it("starts the next focus block after a rest", () => {
    const rest = startRest(working, DEFAULT_SETTINGS, T0);
    expect(
      startNextSession(rest, DEFAULT_SETTINGS, T0 + seconds(5)),
    ).toMatchObject({
      phase: "work",
      session: 2,
      completedSessions: 1,
      durationSeconds: 1500,
      runningSince: T0 + seconds(5),
    });
  });

  it("ignores a transition that does not fit the current phase", () => {
    const rest = startRest(working, DEFAULT_SETTINGS, T0);
    expect(startRest(rest, DEFAULT_SETTINGS, T0)).toBe(rest);
    expect(startNextSession(working, DEFAULT_SETTINGS, T0)).toBe(working);
  });

  it("takes new durations from the settings only when a phase begins", () => {
    const longer = { ...DEFAULT_SETTINGS, workMinutes: 50, restMinutes: 10 };
    expect(remainingSeconds(working, T0)).toBe(1500);
    const rest = startRest(working, longer, T0);
    expect(rest.durationSeconds).toBe(600);
    expect(startNextSession(rest, longer, T0).durationSeconds).toBe(3000);
  });
});

describe("withIdleDuration", () => {
  const longer = { ...DEFAULT_SETTINGS, workMinutes: 50 };

  it("gives a block that has not begun the new length", () => {
    const state = withIdleDuration(initialSession(DEFAULT_SETTINGS), longer);
    expect(remainingSeconds(state, T0)).toBe(3000);
  });

  it("keeps a running or partly elapsed block as it was", () => {
    const running = resume(initialSession(DEFAULT_SETTINGS), T0);
    expect(withIdleDuration(running, longer)).toBe(running);
    const paused = pause(running, T0 + seconds(30));
    expect(withIdleDuration(paused, longer)).toBe(paused);
  });
});

describe("persistence", () => {
  it("round-trips a session per task", () => {
    const state = resume(initialSession(DEFAULT_SETTINGS), T0);
    saveSession(7, state);
    expect(loadSession(7)).toEqual(state);
    expect(loadSession(8)).toBeNull();
  });

  it("ignores corrupt or malformed data", () => {
    localStorage.setItem("pomodoro-session-7", "{not json");
    expect(loadSession(7)).toBeNull();
    localStorage.setItem(
      "pomodoro-session-7",
      JSON.stringify({ phase: "nap" }),
    );
    expect(loadSession(7)).toBeNull();
  });

  it("forgets a cleared task", () => {
    saveSession(7, initialSession(DEFAULT_SETTINGS));
    clearSession(7);
    expect(loadSession(7)).toBeNull();
  });
});
