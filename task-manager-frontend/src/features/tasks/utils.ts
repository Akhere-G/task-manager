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
} from "date-fns";

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
