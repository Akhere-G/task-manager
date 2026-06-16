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
  addWeeks,
  addMonths,
  addYears,
} from "date-fns";
import type { Task } from "./types";
import { Views, type Event, type View } from "react-big-calendar";

export const formatDate = (dateStr?: string) => {
  const date = dateStr ? new Date(dateStr) : new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const formatDateRange = (startAt: string, endAt: string) => {
  const endDate = new Date(endAt);
  const startDate = new Date(startAt);
  const sameDay = isSameDay(endDate, startDate);
  const sameYear = isSameYear(endDate, startDate);
  const isToday = isSameDay(startAt, new Date());

  let dateStr = "";

  const year = !isSameYear(startDate, new Date()) || !sameYear ? " yy" : "";

  if (isToday && sameDay) {
    dateStr = `${format(new Date(startAt), `HH:mm`)} - ${format(new Date(endAt), "HH:mm")}`;
  } else if (sameDay) {
    dateStr = `${format(new Date(startAt), `d LLL${year}, HH:mm`)} - ${format(new Date(endAt), "HH:mm")}`;
  } else if (sameYear) {
    dateStr = `${format(new Date(startAt), `d LLL${year}, HH:mm`)} - ${format(new Date(endAt), "d LLL, HH:mm")}`;
  } else {
    dateStr = `${format(new Date(startAt), `d LLL${year}, HH:mm`)} - ${format(new Date(endAt), "d LLL, yy HH:mm")}`;
  }

  return dateStr;
};

export const calculateDateRange = (type: string, currentDate: string) => {
  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);

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
        start: subDays(startOfMonth(currentDate), 6),
        end: addDays(endOfMonth(currentDate), 6),
      };
    case "overdue":
      return { start: new Date(2000, 0, 1), end: start };
    default:
      return { start, end };
  }
};

export const formatDateRelative = (date = "") => {
  const dateVal = new Date(date);
  const today = new Date();
  const sameDay = isSameDay(dateVal, today);
  const sameYear = isSameYear(dateVal, today);

  if (sameDay) return format(dateVal, "p");
  if (sameYear) return format(dateVal, "dd MMM");
  return format(dateVal, "dd MMM yyyy");
};

export function skipDate(date: Date, repeatBy: string) {
  switch (repeatBy) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addWeeks(date, 1);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addYears(date, 1);
  }
  throw new Error(
    'Repeat by must be one of: "daily", "weekly", "monthly", "yearly"',
  );
}

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
    : "!bg-brand !text-text-inverse";

  return `!border-none !shadow-sm !rounded-md !px-1 !py-1 !text-xs !font-medium transition-all ${statusClasses}`;
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
      start: new Date(task.startAt),
      end: new Date(task.endAt),
      allDay: false,
      resource: task,
    }));
  }

  const uniqueDayLookup: Record<string, number> = {};
  tasks.forEach((task) => {
    const date = format(new Date(task.startAt), "yyyy-MM-dd");
    uniqueDayLookup[date] = (uniqueDayLookup[date] || 0) + 1;
  });

  return Object.entries(uniqueDayLookup).map(([dayStr, count]) => ({
    id: dayStr,
    title: "",
    start: new Date(dayStr),
    end: new Date(dayStr),
    allDay: true,
    resource: count,
  }));
}
