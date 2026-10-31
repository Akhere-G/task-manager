import {
  format,
  isSameDay,
  isSameYear,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import type { CSSProperties } from "react";
import type { Task } from "./types";
import { calendarColoursDark, calendarColoursLight } from "./constants";
import { Views, type Event, type View } from "react-big-calendar";

export const formatDate = (dateStr?: string) => {
  const date = dateStr ? parseISO(dateStr) : new Date();
  return format(date, "yyyy-MM-dd");
};

export const formatDateRange = (startAt: string, endAt: string) => {
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

export const calculateDateRange = (type: string, currentDate: string) => {
  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);
  const monthStart = startOfMonth(parseISO(currentDate));
  const monthEnd = endOfMonth(parseISO(currentDate));
  switch (type) {
    case "today":
      return { start, end };
    case "this_week":
      return {
        start,
        end: addDays(end, 6),
      };
    case "this_month":
      return { start, end: addDays(end, 30) };
    case "calendar_view":
      return {
        start: subDays(monthStart, 6),
        end: addDays(monthEnd, 6),
      };
    case "overdue":
      return { start: new Date(2000, 0, 1), end: start };
    default:
      return { start, end };
  }
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

export function getEventStyle(
  event: Event,
  isMobile: boolean,
  view: View,
  darkMode: boolean,
): CSSProperties {
  if (isMobile && view === Views.MONTH) return {};

  const task = event.resource as Task;
  if (task.isCompleted) return {};

  const palette = darkMode ? calendarColoursDark : calendarColoursLight;
  const backgroundColor = palette[task.category] ?? palette["general"];

  return { backgroundColor, color: "#ffffff" };
}

export function mapTasksToCalendarEvents(
  tasks: Task[],
  isMobile: boolean,
  view: View,
) {
  if (!isMobile || view !== Views.MONTH) {
    return tasks.map((task) => ({
      id: task.id,
      title: task.title || "(No Title)",
      start: parseISO(task.startAt),
      end: parseISO(task.endAt),
      allDay: false,
      resource: task,
    }));
  }

  const uniqueDayLookup: Record<string, number> = {};
  tasks.forEach((task) => {
    const date = format(parseISO(task.startAt), "yyyy-MM-dd");
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
