import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./constants";
import { loadSettings, normalizeSettings, saveSettings } from "./settings";

describe("normalizeSettings", () => {
  it("falls back to the defaults for anything that is not an object", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("25")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and defaults the missing or invalid ones", () => {
    expect(normalizeSettings({ workMinutes: 50, restMinutes: "ten" })).toEqual({
      ...DEFAULT_SETTINGS,
      workMinutes: 50,
    });
  });

  it("clamps to the limits and rounds to whole minutes", () => {
    expect(
      normalizeSettings({
        workMinutes: 999,
        restMinutes: 0,
        longRestMinutes: 12.6,
      }),
    ).toEqual({ workMinutes: 180, restMinutes: 1, longRestMinutes: 13 });
  });
});

describe("saved settings", () => {
  it("round-trips through local storage", () => {
    const settings = { workMinutes: 40, restMinutes: 8, longRestMinutes: 20 };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("loads the defaults when nothing is stored or the data is corrupt", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem("pomodoro-settings", "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
