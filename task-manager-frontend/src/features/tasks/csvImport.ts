import {
  defaultDays,
  getBrowserTimeZone,
  parseRepeatDays,
  parseRepeatInterval,
} from "./recurrence";
import { parsePriority } from "./utils";

type CsvRow = Record<string, string>;

const TRUE_VALUES = ["1", "true"];

const headerKey = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Reads cells by header, ignoring case, spaces, underscores and dashes. */
function cellReader(row: CsvRow) {
  const cells = new Map(
    Object.entries(row).map(([header, value]) => [headerKey(header), value]),
  );
  return (...names: string[]): string => {
    for (const name of names) {
      const value = cells.get(name)?.trim();
      if (value) return value;
    }
    return "";
  };
}

export function parseTaskRow(row: CsvRow, zoneName = getBrowserTimeZone()) {
  const read = cellReader(row);
  const repeatBy = read("repeatby") || null;
  const startAt = read("startat") || null;
  const createdAt = read("createdat");
  const completedAt = read("completedat");

  const repeatInterval = repeatBy
    ? parseRepeatInterval(read("repeatinterval"))
    : undefined;
  const repeatDays = repeatBy
    ? (parseRepeatDays(repeatBy, read("repeatdays")) ??
      defaultDays(startAt, repeatBy))
    : null;
  const repeatTimezone = repeatBy
    ? read("repeattimezone", "repeattz") || zoneName
    : null;

  return {
    title: read("title"),
    projectName: read("project", "category"),
    priority: parsePriority(read("priority")),
    description: read("description") || null,
    startAt,
    endAt: read("endat") || null,
    isCompleted: TRUE_VALUES.includes(read("iscompleted").toLowerCase()),
    completedAt: completedAt || null,
    repeatBy,
    repeatUntil: read("repeatuntil") || null,
    isRepeating: !!repeatBy,
    ...(createdAt ? { createdAt } : {}),
    ...(repeatInterval !== undefined ? { repeatInterval } : {}),
    ...(repeatDays ? { repeatDays } : {}),
    ...(repeatTimezone ? { repeatTimezone } : {}),
  };
}

export type ImportedTask = ReturnType<typeof parseTaskRow>;

export const parseTaskRows = (rows: CsvRow[], zoneName?: string | null) =>
  rows.map((row) => parseTaskRow(row, zoneName));
