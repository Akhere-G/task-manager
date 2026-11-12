import {
  format,
  isSameDay,
  isSameYear,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  parseISO,
} from "date-fns";
import type { CSSProperties } from "react";
import { DEFAULT_PRIORITY, type Priority, type Task } from "./types";
import { DEFAULT_PROJECT_COLOUR, type Project } from "../projects/types";
import { Views, type Event, type View } from "react-big-calendar";

export const formatDate = (dateStr?: string) => {
  const date = dateStr ? parseISO(dateStr) : new Date();
  return format(date, "yyyy-MM-dd");
};

export const NO_DATE_LABEL = "No date";

export const formatDateRange = (
  startAt: string | null,
  endAt: string | null,
) => {
  if (!startAt || !endAt) return NO_DATE_LABEL;
  const startDate = parseISO(startAt);
  const endDate = parseISO(endAt);
  const now = new Date();
  const sameDay = isSameDay(endDate, startDate);
  const sameYear = isSameYear(endDate, startDate);
  const isToday = isSameDay(startDate, now);

  const year = !isSameYear(startDate, now) || !sameYear ? " yy" : "";

  if (isToday && sameDay) {
    return `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`;
  } else if (sameDay) {
    return `${format(startDate, `d LLL${year}, HH:mm`)} - ${format(endDate, "HH:mm")}`;
  } else if (sameYear) {
    return `${format(startDate, `d LLL${year}, HH:mm`)} - ${format(endDate, "d LLL, HH:mm")}`;
  } else {
    return `${format(startDate, `d LLL${year}, HH:mm`)} - ${format(endDate, "d LLL, yy HH:mm")}`;
  }
};

/** The span the calendar loads: the month around a date plus a week's overlap each side. */
export const calendarRange = (currentDate: string) => {
  const date = parseISO(currentDate);
  return {
    start: subDays(startOfMonth(date), 6),
    end: addDays(endOfMonth(date), 6),
  };
};

export const formatDateRelative = (date = "") => {
  const dateVal = parseISO(date);
  const today = new Date();
  const sameDay = isSameDay(dateVal, today);
  const sameYear = isSameYear(dateVal, today);

  if (sameDay) return format(dateVal, "p");
  if (sameYear) return format(dateVal, "dd MMM");
  return format(dateVal, "dd MMM yyyy");
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const daysUntilPurge = (purgeAt: string, now = new Date()) =>
  Math.max(
    0,
    Math.ceil((parseISO(purgeAt).getTime() - now.getTime()) / MS_PER_DAY),
  );

export const getCalendarTaskId = (task: Task): number =>
  task.isGhost ? task.seriesId : task.id;

export const calendarFormats = (isMobile: boolean) => ({
  dayFormat: (date: Date) =>
    isMobile ? format(date, "dd") : format(date, "EEE dd/MM"),
  timeGutterFormat: (date: Date) =>
    isMobile ? format(date, "HH") : format(date, "p"),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    isMobile
      ? `${format(start, "H")} - ${format(end, "H")}`
      : `${format(start, "p")} - ${format(end, "p")}`,
});

export function getDayClassName(date: Date, currentDate: Date): string {
  const isSelected = isSameDay(date, currentDate);
  const isToday = isSameDay(date, new Date());
  const isCurrentMonth = date.getMonth() === currentDate.getMonth();

  const classes = [
    "transition-all",
    "duration-150",
    "cursor-pointer",
    "relative",
  ];

  classes.push(isCurrentMonth ? "bg-surface" : "bg-surface-muted!");
  classes.push(
    isSelected ? "bg-brand/20! dark:!bg-brand/50" : "hover:bg-brand/20",
  );
  if (isToday) classes.push("!font-bold", "bg-blue-200! dark:bg-blue-600/50!");

  return classes.join(" ");
}

export function getEventClassName(
  event: Event,
  isMobile: boolean,
  view: View,
): string {
  if (isMobile && view === Views.MONTH) {
    return "!bg-transparent !border-none !shadow-none !pointer-events-none";
  }

  const task = event.resource as Task;
  const statusClasses = task.isCompleted
    ? "!bg-slate-200 !text-slate-500 !line-through"
    : "";

  return `!border-none !shadow-sm !rounded-md !px-1 !py-1 !text-xs !font-bold transition-all ${statusClasses}`;
}

const DARK_MODE_FACTOR = 0.7;

function darken(hex: string): string {
  const channel = (start: number) =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * DARK_MODE_FACTOR)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export function getEventStyle(
  event: Event,
  isMobile: boolean,
  view: View,
  darkMode: boolean,
  projects: Project[] = [],
): CSSProperties {
  if (isMobile && view === Views.MONTH) return {};

  const task = event.resource as Task;
  if (task.isCompleted) return {};

  const colour =
    projects.find((p) => p.id === task.projectId)?.colour ??
    DEFAULT_PROJECT_COLOUR;
  const backgroundColor = darkMode ? darken(colour) : colour;

  return { backgroundColor, color: "#ffffff" };
}

export function mapTasksToCalendarEvents(
  tasks: Task[],
  isMobile: boolean,
  view: View,
) {
  const dated = tasks.flatMap((task) =>
    task.startAt && task.endAt
      ? [{ task, startAt: task.startAt, endAt: task.endAt }]
      : [],
  );
  if (!isMobile || view !== Views.MONTH) {
    return dated.map(({ task, startAt, endAt }) => ({
      id: task.id,
      title: task.title || "(No Title)",
      start: parseISO(startAt),
      end: parseISO(endAt),
      allDay: false,
      resource: task,
    }));
  }

  const uniqueDayLookup: Record<string, number> = {};
  dated.forEach(({ startAt }) => {
    const date = format(parseISO(startAt), "yyyy-MM-dd");
    uniqueDayLookup[date] = (uniqueDayLookup[date] || 0) + 1;
  });

  return Object.entries(uniqueDayLookup).map(([dayStr, count]) => ({
    id: dayStr,
    title: "",
    start: parseISO(dayStr),
    end: parseISO(dayStr),
    allDay: true,
    resource: count,
  }));
}

export const playSound = async (src: string) => {
  const sound = new Audio(src);
  await sound.play();
};

/** Reads "1"–"4" or "P1"–"P4" from an imported CSV cell; anything else is P4. */
export function parsePriority(value: string | undefined): Priority {
  const match = /^p?([1-4])$/i.exec((value ?? "").trim());
  return match ? (Number(match[1]) as Priority) : DEFAULT_PRIORITY;
}

export const groupByPriority = (tasks: Task[]): Record<Priority, Task[]> => {
  const groups: Record<Priority, Task[]> = { 1: [], 2: [], 3: [], 4: [] };
  tasks.forEach((task) => groups[task.priority].push(task));
  return groups;
};
