import { getDate, getDay, getMonth } from "date-fns";
import type { Task } from "./types";

export type RepeatDay = number | string;

export const REPEAT_LIMITS: Record<string, number> = {
  daily: 365,
  weekly: 52,
  monthly: 24,
  yearly: 10,
};

export const REPEAT_UNITS: Record<string, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const getBrowserTimeZone = (): string | null =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || null;

export const pad = (n: number) => String(n).padStart(2, "0");

export function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** The single day matching `startAt` in the browser's time zone (Monday = 0). */
export function defaultDays(
  startAt: string | Date | null | undefined,
  repeatBy: string | null | undefined,
): RepeatDay[] | null {
  const date = startAt ? new Date(startAt) : null;
  if (!date || isNaN(date.getTime())) return null;
  switch (repeatBy) {
    case "weekly":
      return [(getDay(date) + 6) % 7];
    case "monthly":
      return [getDate(date)];
    case "yearly":
      return [`${pad(getMonth(date) + 1)}-${pad(getDate(date))}`];
    default:
      return null;
  }
}

export function sortDays(repeatBy: string, days: RepeatDay[]): RepeatDay[] {
  if (repeatBy === "yearly") return [...days].map(String).sort();
  return [...days].map(Number).sort((a, b) => a - b);
}

function formatDay(repeatBy: string, day: RepeatDay) {
  if (repeatBy === "weekly") return WEEKDAY_NAMES[Number(day)] ?? String(day);
  if (repeatBy === "monthly") return ordinal(Number(day));
  const [month, date] = String(day).split("-").map(Number);
  return `${date} ${MONTH_NAMES[month - 1] ?? ""}`.trim();
}

type RecurrenceFields = Pick<
  Task,
  "repeatBy" | "repeatInterval" | "repeatDays"
>;

export function describeRecurrence({
  repeatBy,
  repeatInterval,
  repeatDays,
}: RecurrenceFields): string {
  if (!repeatBy || !(repeatBy in REPEAT_UNITS)) return repeatBy ?? "";
  const interval = repeatInterval && repeatInterval > 1 ? repeatInterval : 1;
  const unit = REPEAT_UNITS[repeatBy];
  const cycle = interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`;

  if (repeatBy === "daily") {
    return interval === 1 ? "Daily" : `Every ${interval} days`;
  }
  if (!repeatDays?.length) {
    return interval === 1
      ? `${unit[0].toUpperCase()}${unit.slice(1)}ly`
      : `Every ${interval} ${unit}s`;
  }
  const days = sortDays(repeatBy, repeatDays)
    .map((day) => formatDay(repeatBy, day))
    .join(", ");
  return `${days} ${cycle}`;
}

/** e.g. "3 times every 2 weeks" */
export function describeTimes(
  repeatBy: string,
  interval: number,
  count: number,
): string {
  const unit = REPEAT_UNITS[repeatBy];
  if (!unit) return "";
  const times = count === 1 ? "Once" : `${count} times`;
  return `${times} ${interval > 1 ? `every ${interval} ${unit}s` : `every ${unit}`}`;
}

export function isValidRepeatDay(repeatBy: string, day: unknown): boolean {
  if (repeatBy === "weekly") {
    return (
      Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6
    );
  }
  if (repeatBy === "monthly") {
    return (
      Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 31
    );
  }
  if (repeatBy === "yearly") {
    if (typeof day !== "string" || !/^\d\d-\d\d$/.test(day)) return false;
    const [month, date] = day.split("-").map(Number);
    return month >= 1 && month <= 12 && date >= 1 && date <= daysInMonth(month);
  }
  return false;
}

// 2024 is a leap year, so Feb 29 is accepted.
const daysInMonth = (month: number) => new Date(2024, month, 0).getDate();

const CSV_DAY_SEPARATOR = ";";

/** CSV cell for the chosen days: "Mon;Thu", "1;15" or "02-14;12-25". */
export function formatRepeatDays(
  repeatBy: string | null | undefined,
  days: RepeatDay[] | null | undefined,
): string {
  if (!repeatBy || !days?.length) return "";
  return sortDays(repeatBy, days)
    .map((day) =>
      repeatBy === "weekly" ? (WEEKDAY_NAMES[Number(day)] ?? day) : day,
    )
    .join(CSV_DAY_SEPARATOR);
}

/**
 * Reads a CSV cell written by formatRepeatDays. Weekdays may be names (Mon, Monday)
 * or numbers (Monday = 0). Anything unreadable is kept as text so validation rejects it.
 */
export function parseRepeatDays(
  repeatBy: string | null | undefined,
  text: string | null | undefined,
): RepeatDay[] | null {
  const tokens = (text ?? "")
    .split(/[;|]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!repeatBy || tokens.length === 0) return null;

  return tokens.map((token) => {
    if (repeatBy === "weekly") {
      const index = WEEKDAY_NAMES.findIndex(
        (name) => name.toLowerCase() === token.slice(0, 3).toLowerCase(),
      );
      if (index !== -1 && /^[a-z]+$/i.test(token)) return index;
    }
    if (repeatBy === "weekly" || repeatBy === "monthly") {
      return /^\d+$/.test(token) ? Number(token) : token;
    }
    return token;
  });
}

export function parseRepeatInterval(
  text: string | null | undefined,
): number | undefined {
  const value = (text ?? "").trim();
  if (!value) return undefined;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}
