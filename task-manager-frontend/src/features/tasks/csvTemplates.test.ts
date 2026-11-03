import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { parseTaskRows } from "./csvImport";
import { templateCsv, type TemplateKind } from "./csvTemplates";
import { validateTaskList } from "./schemas";

const TODAY = new Date(2026, 5, 10, 12, 0);

function importTemplate(kind: TemplateKind) {
  const { data } = Papa.parse<Record<string, string>>(
    templateCsv(kind, TODAY),
    {
      header: true,
      skipEmptyLines: true,
    },
  );
  return parseTaskRows(data, "Europe/London");
}

describe.each<TemplateKind>(["simple", "advanced"])("%s template", (kind) => {
  const tasks = importTemplate(kind);

  it("passes the same validation as an upload", () => {
    const errors = validateTaskList(tasks);
    expect(errors.filter((error) => Object.keys(error).length > 0)).toEqual([]);
  });

  it("never sends a null createdAt", () => {
    expect(tasks.every((task) => !("createdAt" in task))).toBe(true);
  });

  it("has a one-off, a dateless and every kind of repeating example", () => {
    const repeats = tasks
      .filter((task) => task.repeatBy)
      .map((task) => [task.repeatBy, task.repeatInterval]);
    expect(tasks.some((task) => !task.repeatBy && task.startAt)).toBe(true);
    expect(tasks.some((task) => !task.repeatBy && !task.startAt)).toBe(true);
    expect(repeats).toEqual(
      expect.arrayContaining([
        ["daily", 1],
        ["daily", 2],
        ["weekly", 1],
        ["weekly", 2],
        ["monthly", 1],
        ["yearly", 1],
      ]),
    );
  });

  it("takes the time zone of repeating tasks from the browser", () => {
    const zones = tasks.filter((t) => t.repeatBy).map((t) => t.repeatTimezone);
    expect(new Set(zones)).toEqual(new Set(["Europe/London"]));
  });
});

it("gives the advanced template more rows and the completion columns", () => {
  expect(importTemplate("advanced").length).toBeGreaterThan(
    importTemplate("simple").length,
  );
  expect(templateCsv("advanced", TODAY).split("\n")[0]).toContain(
    "Is Completed",
  );
  expect(templateCsv("simple", TODAY).split("\n")[0]).not.toContain(
    "Is Completed",
  );
  expect(templateCsv("simple", TODAY).split("\n")[0]).not.toContain(
    "Time Zone",
  );
});

it("fills in the days of a repeating row that leaves them blank", () => {
  const [task] = parseTaskRows(
    [
      {
        Title: "x",
        "Start At": "2026-06-10 09:00",
        "End At": "2026-06-10 10:00",
        "Repeat By": "weekly",
      },
    ],
    "UTC",
  );
  expect(task.repeatDays).toEqual([2]);
});
