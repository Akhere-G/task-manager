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
